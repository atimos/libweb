'use strict';

import ResultMap from '../common/resultmap';
import {build_index as build_index, search as fulltext_search} from './fulltext';

let instances = new Map();

export function load(config) {
	return load_db(config).then(db => {
		let db_obj, index_map;

		db_obj = {
			transaction: function(store_list, mode = 'readonly') {
				return new Transaction(db, store_list, mode, index_map);
			},

			store: function(name, mode) {
				return {
					add: (...args) => { return this.transaction([{name: name}], mode || 'readwrite').store(name).delete(...args); },
					put: (...args) => { return this.transaction([{name: name}], mode || 'readwrite').store(name).put(...args); },
					delete: (...args) => { return this.transaction([{name: name}], mode || 'readwrite').store(name).delete(...args); },
					get: (...args) => { return this.transaction([{name: name}], mode || 'readonly').store(name).get(...args); },
					range: (...args) => { return this.transaction([{name: name}], mode || 'readonly').store(name).range(...args); },
					search: (...args) => { return this.transaction([{name: name}], mode || 'readonly').store(name).search(...args); }
				};
			},

			delete: function() {
				return new Promise((resolve, reject) => {
					let request = window.indexedDB.deleteDatabase(name);

					request.addEventListener('success', resolve);
					request.addEventListener('error', reject);
				});
			}
		};

		return build_index(db_obj, config.fulltext).then(new_index_map => {
			index_map = new_index_map;
			return db_obj;
		});
	});
}

class Transaction {
	constructor(db, store_list, mode, index_map) {
		this.store_map = new Map();
		this.index_map = index_map || new Map();

		this.transaction = db.transaction(store_list.map(store => {
			this.store_map.set(store.name, store);
			return store.name;
		}), mode);
	}

	store(name) {
		if ( this.has(name) ) {
			return new Store(this.transaction, this.store_map.get(name), this.index_map.get(name));
		} else {
			return false;
		}
	}

	has(name) {
		return this.store_map.has(name);
	}
}

class Store {
	constructor(transaction, store, index) {
		this.store = transaction.objectStore(store.name);
		this.index = index;

		if ( store.index ) {
			this.store = this.store.index(store.index);
		}
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

	range(type, ...args) {
		return new Range(this.store, type, ...args);
	}

	add(...args) {
		return update_store(this.store, this.index, 'add', ...args);
	}

	put(...args) {
		return update_store(this.store, this.index, 'put', ...args);
	}

	delete(...args) {
		return update_store(this.store, this.index, 'delete', ...args);
	}

	search(query) {
		return new Promise(resolve => {
			let result = new ResultMap();

			if ( this.index !== undefined ) {
				let id_list = this.index.search(query).map(item => {
					result.set(item.ref, {value: null, score: item.score});
					return item.ref;
				}).sort();

				if ( id_list.length === 0 ) {
					resolve(result);
				} else {
					this.range('lowerupper', id_list[0], id_list[id_list.length - 1]).cursor(cursor => {
						id_list.shift();

						result.set(cursor.primaryKey, {
							value: cursor.value,
							score: result.get(cursor.primaryKey).score
						});

						if ( id_list.length > 0 ) {
							cursor.continue(id_list.shift());
						}

					}).then(() => {
						resolve(result);
					});
				}
			} else {
				resolve(result);
			}
		});
	}
}

class Range {
	constructor(store, type, ...args) {
		this.store = store;
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
	}

	then(resolve, reject) {
		return this.cursor().then(resolve, reject);
	}

	cursor(fn, direction = 'next') {
		return new Promise((resolve, reject) => {
			let result = new ResultMap(),
				has_fn = ( Object.prototype.toString.call(fn) === '[object Function]' ? true : false );

			this.store.transaction.addEventListener('error', evt => {
				evt.preventDefault();
				this.store.transaction.abort();
				reject(evt.target.error);
			});

			this.store.transaction.addEventListener('complete', () => {
				resolve(result);
			});

			this.store.openCursor(this.range, direction).addEventListener('success', evt => {
				let cursor = evt.target.result;

				if ( cursor === null || cursor === undefined ) {
					return cursor;
				} else {
					if ( cursor.primaryKey !== undefined ) {
						if ( has_fn === true ) {
							fn(cursor, result);
						} else {
							result.set(cursor.primaryKey, cursor.value);
							cursor.continue();
						}
					} else {
						cursor.continue();
					}
				}
			});
		});
	}

	count() {
		return new Promise((resolve, reject) => {

			this.store.transaction.addEventListener('error', evt => {
				evt.preventDefault();
				this.store.transaction.abort();
				reject(evt.target.error);
			});

			this.store.count(this.range).addEventListener('success', function() {
				resolve(this.result);
			});
		});
	}
}

function update_store(store, index, action, data) {
	return new Promise((resolve, reject) => {
		let result = new ResultMap();

		store.transaction.addEventListener('error', evt => {
			evt.preventDefault();
			store.transaction.abort();
			reject(evt.target.error);
		});

		store.transaction.addEventListener('complete', () => {
			resolve(result);
		});


		(Array.isArray(data)?data:[data]).forEach(item => {
			let request = store[action](item);
			request.addEventListener('success', evt => {
				result.set(evt.target.result, item);

				if ( index !== undefined ) {
					index[action](item);
				}
			});
		});
	});
}

function load_db(config) {
	return new Promise((resolve, reject) => {
		if ( instances.has(config.name) ) {
			resolve(instances.get(config.name));
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
				instances.set(config.name, evt.target.result);
				resolve(instances.get(config.name));
			});

			request.addEventListener('error', evt => {
				evt.preventDefault();
				reject(evt.target.error);
			});
		}
	});
}
