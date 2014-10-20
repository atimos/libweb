'use strict';

let _store = window.Symbol('store'), get_db_instance;

import ResultMap from '../common/resultmap';

export default function(config) {
	return {
		store: function(store_name) {
			let store_list = [{name: store_name}];

			return {
				cursor: (...cursor_args) => {
					return {
						count: (...count_args) => {
							return this.transaction(store_list, 'readonly').then(req => {
								return req[store_name].cursor(...cursor_args).count(...count_args);
							});
						},
						entries: (...entries_args) => {
							return this.transaction(store_list, 'readonly').then(req => {
								return req[store_name].cursor(...cursor_args).entries(...entries_args);
							});
						}
					};
				},

				get: (...args) => {
					return this.transaction(store_list, 'readonly').then(req => {
						return req[store_name].get(...args);
					});
				},

				add: (...args) => {
					return this.transaction(store_list, 'readwrite').then(req => {
						return req[store_name].add(...args);
					});
				},

				put: (...args) => {
					return this.transaction(store_list, 'readwrite').then(req => {
						return req[store_name].put(...args);
					});
				},

				delete: (...args) => {
					return this.transaction(store_list, 'readwrite').then(req => {
						return req[store_name].delete(...args);
					});
				},
			};
		},

		transaction: function(store_list, mode = 'readonly') {
			return get_db_instance(config).then(db => {
				let transaction;

				transaction = db.transaction(store_list.map(store => {
					return store.name;
				}), mode);

				return store_list.reduce((store_list, store_config) => {
					let store = transaction.objectStore(store_config.name);

					if ( store_config.index ) {
						store = store.index(store.index);
					}

					store_list[store.name] = new Store(store);

					return store_list;
				}, {});
			});
		},

		reset: function() {
			return new Promise((resolve, reject) => {
				let request = window.indexedDB.deleteDatabase(config.name);

				request.addEventListener('success', resolve);
				request.addEventListener('error', reject);
			});
		}
	};
}

class Store {
	constructor(store) {
		this[_store] = store;
	}

	cursor(type, ...args) {
		let range;
		switch ( type ) {
			case 'only':
				range = window.IDBKeyRange.only(args.shift());
				break;
			case 'lower':
				range = window.IDBKeyRange.lowerBound(args.shift(), args.shift() || false);
				break;
			case 'upper':
				range = window.IDBKeyRange.upperBound(args.shift(), args.shift() || false);
				break;
			case 'lowerupper':
				range = window.IDBKeyRange.bound(args.shift(), args.shift(), args.shift() || false, args.shift() || false);
				break;
		}
		return {
			entries: (...args) => {
				return cursor_entries.call(this, range, ...args);
			},
			count: (...args) => {
				return cursor_count.call(this, range, ...args);
			}
		};
	}

	get(id) {
		return new Promise((resolve, reject) => {
			this[_store].transaction.addEventListener('error', evt => {
				evt.preventDefault();
				this[_store].transaction.abort();
				reject(evt.target.error);
			});

			this[_store].get(id).addEventListener('success', evt => {
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

get_db_instance = (function() {
	let instance_map = new Map();

	return function(config) {
		return new Promise((resolve, reject) => {
			if ( instance_map.has(config.name) ) {
				resolve(instance_map.get(config.name));
			} else {
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
					instance_map.set(config.name, evt.target.result);
					resolve(instance_map.get(config.name));
				});

				request.addEventListener('error', evt => {
					evt.preventDefault();
					reject(evt.target.error);
				});
			}
		});
	};
}());

function update_store(type, data) {
	return new Promise((resolve, reject) => {
		let result = new ResultMap();

		this[_store].transaction.addEventListener('error', evt => {
			evt.preventDefault();
			this[_store].transaction.abort();
			reject(evt.target.error);
		});

		this[_store].transaction.addEventListener('complete', () => {
			resolve(result);
		});

		(Array.isArray(data)?data:[data]).forEach(item => {
			let request = this[_store][type](item);
			request.addEventListener('success', evt => {
				result.set(evt.target.result, item);
			});
		});
	});
}

function cursor_entries(range, fn, direction = 'next') {
	return new Promise((resolve, reject) => {
		let result = new ResultMap(),
			callback = (Object.prototype.toString.call(fn)==='[object Function]'?true:false);

		this[_store].transaction.addEventListener('error', evt => {
			evt.preventDefault();
			this[_store].transaction.abort();
			reject(evt.target.error);
		});

		this[_store].transaction.addEventListener('complete', () => {
			resolve(result);
		});

		this[_store].openCursor(range, direction).addEventListener('success', evt => {
			let cursor = evt.target.result;

			if ( cursor === null || cursor === undefined ) {
				return cursor;
			} else {
				if ( callback === true ) {
					fn(cursor, result);
				} else {
					if ( cursor.primaryKey !== undefined ) {
						result.set(cursor.primaryKey, cursor.value);
					}
					cursor.continue();
				}
			}
		});
	});
}

function cursor_count(range) {
	return new Promise((resolve, reject) => {

		this[_store].transaction.addEventListener('error', evt => {
			evt.preventDefault();
			this[_store].transaction.abort();
			reject(evt.target.error);
		});

		this[_store].count(range).addEventListener('success', function() {
			resolve(this.result);
		});
	});
}
