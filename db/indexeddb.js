'use strict';

import LwMap from '../lwmap/lwmap';

let _trans = Symbol('trans'),
	_store = Symbol('store'),
	_range = Symbol('range'),
	_name = Symbol('name');

export function delete_indexeddb(name) {
	return new Promise((resolve, reject) => {
		var request = window.indexedDB.deleteDatabase(name);

		request.addEventListener('success', resolve);

		request.addEventListener('error', evt => {
			reject(evt.target.error);
		});
	});
}

export function load_indexeddb(name, version) {
	let config_map = new Map();

	return {
		set: function(name, config) {
			config_map.set(name, config);
			return this;
		},
		then: (resolve, reject) => {
			let _config_map = config_map;

			return new Promise((resolve, reject) => {
				let request;

				if ( version !== undefined ) {
					request = window.indexedDB.open(name, version);
				} else {
					request = window.indexedDB.open(name);
				}

				request.addEventListener('upgradeneeded', evt => {

					for ( let entry of _config_map.entries() ) {
						let [name, options] = entry,
							store = evt.target.result.createObjectStore(name, options),
							index = options.index || [];

						Array.prototype
							.filter.call(store.indexNames, name => {
								return !index
									.some(index => {
										return name === index.name;
									});
							})
							.forEach(name => {
								store.deleteIndex(name);
							});

						index
							.forEach(config => {
								if ( store.indexNames.contains(config.name) ) {
									let index = store.index(config.name);

									if ( index.name !== config.name ||
										index.keyPath !== (config.keyPath || config.name) ||
										index.unique !== config.unique ||
										index.multiEntry !== config.multi_entry
									   ) {
										   store.deleteIndex(config.name);
										   store.createIndex(config.name, config.keyPath || config.name, {unique: config.unique, multiEntry: config.multi_entry});
									   }
								} else {
									store.createIndex(config.name, config.keyPath || config.name, {unique: config.unique, multiEntry: config.multi_entry});
								}
							});

					}
				});

				request.addEventListener('success', evt => {
					resolve(db(evt.target.result));
				});

				request.addEventListener('error', evt => {
					evt.preventDefault();
					reject(evt.target.error);
				});
			}).then(resolve, reject);
		}
	};
}

function db(instance) {
	return function(store_list, mode = 'readonly') {
		return new Promise(resolve => {
			resolve(Array.isArray(store_list)?store_list:[store_list]);
		})
			.then(store_list => {
				let transaction = instance.transaction(store_list, mode);

				store_list = store_list.map(name => {
					return new Store(transaction, name);
				});

				if ( store_list.length === 1 ) {
					return store_list[0];
				} else {
					return store_list;
				}
			});
	};
}

class Store {
	constructor(transaction, name) {
		this[_trans] = transaction;
		this[_name] = name;
	}

	index(name) {
		return new Index(this[_trans].objectStore(this[_name]), name);
	}

	get(key) {
		return new Promise((resolve, reject) => {
			add_transaction_handler(this[_trans], null, reject);
			this[_trans].objectStore(this[_name])
				.get(key)
				.addEventListener('success', evt => {
					resolve(evt.target.result);
				});
		});
	}

	range(...args) {
		return new Range(this[_trans], this[_trans].objectStore(this[_name]), null, ...args);
	}

	add(data) {
		return new Promise((resolve, reject) => {
			let result = new LwMap();
			add_transaction_handler(this[_trans], resolve, reject, result);
			update_database(this[_trans].objectStore(this[_name]), 'add', data, result);
		});
	}

	put(data) {
		return new Promise((resolve, reject) => {
			let result = new LwMap();
			add_transaction_handler(this[_trans], resolve, reject, result);
			update_database(this[_trans].objectStore(this[_name]), 'put', data, result);
		});
	}

	delete(key_list) {
		return new Promise((resolve, reject) => {
			let result = new LwMap();
			add_transaction_handler(this[_trans], resolve, reject, result);
			update_database(this[_trans].objectStore(this[_name]), 'delete', key_list, result);
		});
	}

	clear() {
		return new Promise((resolve, reject) => {
			add_transaction_handler(this[_trans], null, reject);
			this[_trans].objectStore(this[_name])
				.clear()
				.addEventListener('success', evt => {
					resolve(evt.target.result);
				});
		});
	}
}

class Index {
	constructor(store, name) {
		this[_store] = store;
		this[_name] = name;
	}

	get(key) {
		return new Promise((resolve, reject) => {
			add_transaction_handler(this[_store].transaction, null, reject);
			this[_store].index(this[_name])
				.get(key)
				.addEventListener('success', evt => {
					resolve(evt.target.result);
				});
		});
	}

	getKey(key) {
		return new Promise((resolve, reject) => {
			add_transaction_handler(this[_store].transaction, null, reject);
			this[_store].index(this[_name])
				.getKey(key)
				.addEventListener('success', evt => {
					resolve(evt.target.result);
				});
		});
	}

	range(...args) {
		return new IndexRange(this[_store].transaction, this[_store].index(this[_name]), ...args);
	}
}

class Range {
	constructor(transaction, store, type, ...args) {
		this[_trans] = transaction;
		this[_store] = store;
		this[_range] = {type: type, args};

	}

	get_range() {
		let args = this[_range].args;

		switch ( this[_range].type ) {
			case 'only':
				return window.IDBKeyRange.only(...args);
			case 'lower':
				return window.IDBKeyRange.lowerBound(args.shift(), args.shift() || false);
			case 'upper':
				return window.IDBKeyRange.upperBound(args.shift(), args.shift() || false);
			case 'lowerupper':
				return window.IDBKeyRange.bound(args.shift(), args.shift(), args.shift() || false, args.shift() || false);
			default:
				return null;
		}
	}

	cursor(fn, result = new LwMap(), direction = 'next') {
		return new Promise((resolve, reject) => {
			add_transaction_handler(this[_trans], resolve, reject, result);

			this[_store].openCursor(this.get_range(), direction)
				.addEventListener('success', evt => {
					fn(evt.target.result || null, result);
				});
		});
	}

	count() {
		return new Promise((resolve, reject) => {
			add_transaction_handler(this[_trans], null, reject);

			this[_store]
				.count(this.get_range())
				.addEventListener('success', evt => {
					resolve(evt.target.result);
				});
		});
	}

	then(resolve, reject) {
		return this.cursor((cursor, result) => {
			if ( cursor !== null ) {
				result.set(cursor.primaryKey, cursor.value);
				cursor.continue();
			}
		}).then(resolve, reject);
	}
}

class IndexRange extends Range {
	keyCursor(fn, result = new LwMap(), direction = 'next') {
		return new Promise((resolve, reject) => {
			add_transaction_handler(this[_trans], resolve, reject, result);

			this[_store].openKeyCursor(this.get_range(), direction)
				.addEventListener('success', evt => {
					fn(evt.target.result || null, result);
				});
		});
	}
}

function add_transaction_handler(transaction, resolve, reject, result) {
	transaction.addEventListener('error', evt => {
		evt.preventDefault();
		transaction.abort();
		reject(evt.target.error);
	});

	if ( resolve !== null ) {
		transaction.addEventListener('complete', () => {
			resolve(result);
		});
	}
}

function update_database(store, action, data, result) {
	data = (Array.isArray(data)?data:[data]);

	if ( action === 'delete' ) {
		data.forEach(key => {
			store[action](key).addEventListener('success', () => {
				result.set(key, key);
			});
		});
	} else {
		data.forEach(item => {
			store[action](item).addEventListener('success', evt => {
				result.set(evt.target.result, item);
			});
		});
	}
}
