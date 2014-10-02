'use strict';

import ResultMap from '../common/resultmap';

export default function store(config) {
	let db_instance = null;
	let store_list = [];
	return {
		store: function(new_store_list) {
			store_list = (Array.isArray(new_store_list)?new_store_list:[new_store_list]).map(store => {
				if ( Object.prototype.toString.call(store) === '[object String]' ) {
					return {name: store};
				} else {
					return store;
				}
			});
			return this;
		},

		transaction: function(mode) {
			if ( db_instance !== null ) {
				return new Promise(resolve => {
					resolve(create_transaction(db_instance, store_list, mode));
				});
			} else {
				return get_db_instance(config).then(new_db_instance => {
					db_instance = new_db_instance;
					return create_transaction(db_instance, store_list, mode);
				});
			}
		},

		cursor: function(...cursor_args) {
			return {
				entries: (...entries_args) => {
					return this.transaction('readonly').then((req) => {
						return req.entries().next().value[1].cursor(...cursor_args).entries(...entries_args);
					});
				}
			};
		},

		get: function(...args) {
			return this.transaction('readonly').then((req) => {
				return req.entries().next().value[1].get(...args);
			});
		},

		add: function(...args) {
			return this.transaction('readwrite').then((req) => {
				return req.entries().next().value[1].add(...args);
			});
		},

		put: function(...args) {
			return this.transaction('readwrite').then((req) => {
				return req.entries().next().value[1].put(...args);
			});
		},

		delete: function(...args) {
			return this.transaction('readwrite').then((req) => {
				return req.entries().next().value[1].delete(...args);
			});
		},

		reset: function() {
			return new Promise((resolve, reject) => {
				let request = window.indexedDB.deleteDatabase(config.name);
				db_instance = null;

				request.addEventListener('success', resolve);
				request.addEventListener('error', reject);
			});
		}
	};
}

class Store {
	constructor(store) {
		this.keyPath = store.keyPath;
		this.store = store;
		this.range = null;
	}

	cursor(type, ...args) {
		switch ( type ) {
			case 'only':
				this.range = window.IDBKeyRange.only(args.shift());
				break;
			case 'lower':
				this.range = window.IDBKeyRange.lowerBound(args.shift(), args.shift() || false);
				break;
			case 'upper':
				this.range = window.IDBKeyRange.upperBound(args.shift(), args.shift() || false);
				break;
			case 'lowerupper':
				this.range = window.IDBKeyRange.bound(args.shift(), args.shift(), args.shift() || false, args.shift() || false);
				break;
		}
		return {
			entries: cursor_entries.bind(this)
		};
	}

	get(id) {
		return new Promise((resolve, reject) => {
			this.store.transaction.addEventListener('error', evt => {
				evt.preventDefault();
				this.store.transaction.abort();
				reject(evt.target.error);
			});

			this.store.get(id).addEventListener('success', evt => {
				resolve(evt.target.result);
			});
		});
	}

	add(...args) {
		return update_store.call(this, 'add', ...args);
	}

	put(...args) {
		return update_store.call(this, 'put', ...args);
	}

	delete(...args) {
		return update_store.call(this, 'delete', ...args);
	}
}

function get_db_instance(config) {
	return new Promise((resolve, reject) => {
		let request;

		if ( config.version !== undefined ) {
			request = window.indexedDB.open(config.name, config.version);
		} else {
			request = window.indexedDB.open(config.name);
		}

		request.addEventListener('upgradeneeded', evt => {
			let db = evt.target.result;

			config.stores.forEach(store => {
				let object_store;

				if(db.objectStoreNames.contains(store.name)) {
					if ( store.options !== undefined ) {
						db.deleteObjectStore(store.name);
						object_store = db.createObjectStore(store.name, store.options);
					}
				} else {
					object_store = db.createObjectStore(store.name, store.options);
				}

				if ( store.index ) {
					store.index.forEach(index => {
						object_store.createIndex(index.name, index.keyPath || index.name, {unique: index.unique});
					});
				}
			});
		});

		request.addEventListener('success', evt => {
			resolve(evt.target.result);
		});

		request.addEventListener('error', evt => {
			evt.preventDefault();
			reject(evt.target.error);
		});
	});
}

function create_transaction(db, store_list, mode) {
	let transaction, store_map = new Map();

	transaction = db.transaction(store_list.map(store => {
		return store.name;
	}), mode);

	store_list.forEach(store_config => {
		let store = transaction.objectStore(store_config.name);

		if ( store_config.index ) {
			store = store.index(store.index);
		}

		store_map.set(store.name, new Store(store));
	});

	return store_map;
}

function update_store(type, data) {
	return new Promise((resolve, reject) => {
		let result = new ResultMap();

		this.store.transaction.addEventListener('error', evt => {
			evt.preventDefault();
			this.store.transaction.abort();
			reject(evt.target.error);
		});

		this.store.transaction.addEventListener('complete', () => {
			resolve(result);
		});

		(Array.isArray(data)?data:[data]).forEach(item => {
			let request = this.store[type](item);
			request.addEventListener('success', evt => {
				result.set(evt.target.result, item);
			});
		});
	});
}

function cursor_entries(fn, direction = 'next') {
	return new Promise((resolve, reject) => {
		let result = new ResultMap(), cursor = null;

		this.store.transaction.addEventListener('error', evt => {
			evt.preventDefault();
			this.store.transaction.abort();
			reject(evt.target.error);
		});

		this.store.transaction.addEventListener('complete', () => {
			resolve(result);
		});

		cursor = this.store.openCursor(this.range, direction);

		if ( Object.prototype.toString.call(fn) === '[object Function]' ) {
			cursor.addEventListener('success', evt => {
				let cursor = evt.target.result;

				if ( cursor === undefined || cursor === null ) {
					return cursor;
				} else {
					fn(cursor, result);
				}
			});
		} else {
			cursor.addEventListener('success', evt => {
				let cursor = evt.target.result;

				if ( cursor === undefined || cursor === null ) {
					return cursor;
				} else {
					result.set(cursor.primaryKey, cursor.value);
					cursor.continue();
				}
			});
		}
	});
}
