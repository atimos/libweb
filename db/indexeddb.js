import Rx from '../rxjs/rxjs';

let uuid = require('../lib/node-uuid/uuid.js');

export function delete_database(name) {
	return new Promise((resolve, reject) => {
		let db_request = window.indexedDB.deleteDatabase(name);

		db_request.addEventListener('success', resolve);

		db_request.addEventListener('error', evt => {
			reject(evt.target.error);
		});
	});
};

export default (db_name, db_version = null) => {
	let db_cfg = new Map();

	return {
		store(name, store_cfg) {
			if ( store_cfg.keyType === 'autoIncrement' ) {
				store_cfg.autoIncrement = true;
			}

			db_cfg.set(name, store_cfg);

			return this;
		},
		then(resolve, reject) {
			return new Promise((resolve, reject) => {
				let db_request = (db_version === null ? window.indexedDB.open(db_name) : window.indexedDB.open(db_name, db_version));

				db_request.addEventListener('upgradeneeded', evt => {
					for ( let [store_name, store_cfg] of db_cfg.entries() ) {
						let store = null;

						if ( evt.target.result.objectStoreNames.contains(store_name) ) {
							evt.target.result.deleteObjectStore(store_name);
						}

						store = evt.target.result.createObjectStore(store_name, store_cfg);

						(store_cfg.index || [])
							.forEach(index_cfg => {
								store.createIndex(index_cfg.name, index_cfg.keyPath || index_cfg.name, index_cfg);
							});
					}
				});

				db_request.addEventListener('success', evt => {
					resolve({
						transaction(store_list = []) {
							return Rx.Observable.create(observer => {
								let transaction = evt.target.result.transaction(store_list, 'readonly');

								transaction.addEventListener('error', evt => { observer.onError(evt.target.error); });
								transaction.addEventListener('complete', observer.onCompleted.bind(observer));

								observer.onNext(store_list.map(name => { return Store.with_transaction(name, db_cfg.get(name), transaction); }));
							});
						},
						transaction_mut(store_list = []) {
							return Rx.Observable.create(observer => {
								let transaction = evt.target.result.transaction(store_list, 'readwrite');

								transaction.addEventListener('error', evt => { observer.onError(evt.target.error); });
								transaction.addEventListener('complete', observer.onCompleted.bind(observer));

								observer.onNext(store_list.map(name => { return StoreMut.with_transaction(name, db_cfg.get(name), transaction); }));
							});
						},
						store(name) {
							return Store.with_db(name, db_cfg.get(name), evt.target.result);
						},
						store_mut(name) {
							return StoreMut.with_db(name, db_cfg.get(name), evt.target.result);
						},
						clear_store(name) {
							return Rx.Observable.create(observer => {
								let transaction = evt.target.result.transaction([name], 'readwrite');

								transaction.addEventListener('error', evt => {
									observer.onError(evt.target.error);
								});

								transaction.objectStore(name).clear().addEventListener('success', evt => {
									observer.onNext();
									observer.onCompleted();
								});
							});
						}
					});
				});

				db_request.addEventListener('error', evt => {
					evt.preventDefault();
					reject(evt.target.error);
				});
			}).then(resolve, reject);
		}
	};
}

class Store {
	static with_transaction(name, cfg, transaction) {
		let store = new this();
		store['name'] = name;
		store['cfg'] = cfg;
		store['transaction'] = transaction;
		return store;
	}

	static with_db(name, cfg, db) {
		let store = new this();
		store['name'] = name;
		store['cfg'] = cfg;
		store['db'] = db;
		store['mode'] = 'readonly';
		return store;
	}

	index(name) {
		let store = clone_object(this);
		store['_index'] = name;
		return store;
	}

	get(keys = []) {
		return get_store_observer(this, (store, observer) => {
			(Array.isArray(keys) ? keys : [keys])
				.forEach(key => {
					store.get(key)
						.addEventListener('success', evt => {
							observer.onNext(new Entry(key, evt.target.result));
						});
				});
		});
	}

	range(...args) {
		return new Range(clone_object(this), ...args);
	}
}

class StoreMut extends Store {
	static with_db(name, cfg, db) {
		let store = super.with_db(name, cfg, db);
		store['mode'] = 'readwrite';
		return store;
	}

	delete(keys = []) {
		return get_store_observer(this, (store, observer) => {
			(Array.isArray(keys) ? keys : [keys])
				.forEach(key => {
					store.delete(key)
						.addEventListener('success', evt => {
							observer.onNext(new Entry(key, null));
						});
				});
		});
	}

	post(data, id = undefined) {
		return get_store_observer(this, (store, observer) => {
			id = add_new_id(data, id, this);

			store.add(data, id)
				.addEventListener('success', evt => {
					observer.onNext(new Entry(evt.target.result, data));
				});
		});
	}

	post_list(data_list) {
		return get_store_observer(this, (store, observer) => {
			data_list.forEach(([data, id]) => {
				id = add_new_id(data, id, this);

				store.add(data, id)
					.addEventListener('success', evt => {
						observer.onNext(new Entry(evt.target.result, data));
					});
			});
		});
	}

	put(data, id = undefined) {
		return get_store_observer(this, (store, observer) => {
			id = add_new_id(data, id, this);

			store.put(data, id)
				.addEventListener('success', evt => {
					observer.onNext(new Entry(evt.target.result, data));
				});
		});
	}

	put_list(data_list) {
		return get_store_observer(this, (store, observer) => {
			data_list.forEach(([data, id]) => {
				id = add_new_id(data, id, this);

				store.put(data, id)
					.addEventListener('success', evt => {
						observer.onNext(new Entry(evt.target.result, data));
					});
			});
		});
	}

	range(...args) {
		return new RangeMut(clone_object(this), ...args);
	}
}

class Range {
	constructor(store, type, ...args) {
		this['store'] = store;

		switch ( type ) {
			case 'only':
				this['range'] = window.IDBKeyRange.only(...args);
				break;
			case 'lower_bound':
				this['range'] = window.IDBKeyRange.lowerBound(args.shift(), args.shift() || false);
				break;
			case 'upper_bound':
				this['range'] = window.IDBKeyRange.upperBound(args.shift(), args.shift() || false);
				break;
			case 'bound':
				this['range'] = window.IDBKeyRange.bound(args.shift(), args.shift(), args.shift() || false, args.shift() || false);
				break;
			default:
				this['range'] = null;
		}
	}

	cursor(fn, direction = 'next') {
		return get_store_observer(this['store'], (store, observer) => {
			store.openCursor(this['range'], direction)
				.addEventListener('success', evt => {
					let cursor = evt.target.result;

					if ( cursor !== null ) {
						observer.observer.cursor = this['get_cursor'](cursor);

						observer.onNext(new Entry(cursor.primaryKey, cursor.value, cursor.key));

						if ( evt.target.readyState !== 'pending' ) {
							cursor.continue();
						}
					}
				});
		});
	}

	['get_cursor'](cursor) {
		return {
			continue: cursor.continue.bind(cursor),
			advance: cursor.advance.bind(cursor)
		};
	}

	count() {
		return get_store_observer(this['store'], (store, observer) => {
			store.count(this['range'])
				.addEventListener('success', evt => {
					observer.onNext(evt.target.result);
				});
		});
	}
}

class RangeMut extends Range {
	['get_cursor'](cursor) {
		return {
			continue: cursor.continue.bind(cursor),
			advance: cursor.advance.bind(cursor),
			update: cursor.update.bind(cursor),
			delete: cursor.delete.bind(cursor)
		};
	}
}

class Entry {
	constructor(primary_key, data, key = null) {
		this['_primary_key'] = primary_key;
		this['data'] = data;
		this['_key'] = key;
	}

	primary_key() {
		return this['_primary_key'];
	}

	key() {
		if ( this['_key'] === null ) {
			return this['_primary_key'];
		}

		return this['_key'];
	}

	get(name) {
		return this['data'][name];
	}

	has(name) {
		return this['data'].hasOwnProperty(name);
	}

	empty() {
		if ( this['data'] === null || this['data'] === undefined ) {
			return true;
		}

		switch ( Object.prototype.toString.call(this['data']) ) {
			case '[object Object]':
				return (Object.keys(this['data']).length === 0);
			case '[object Array]':
				return (this['data'].length === 0);
			case '[object Map]':
			case '[object Set]':
				return (this['data'].size === 0);
		}

		return false;
	}

	to_raw() {
		return this['data'];
	}
}

function get_store_observer(store, cb) {
	return Rx.Observable.create(observer => {
		let transaction = store['transaction'] || store['db'].transaction([store['name']], store['mode']),
			store_obj = transaction.objectStore(store['name']);

		if ( store['_index'] !== undefined ) {
			store_obj = store_obj.index(store['_index']);
		}

		transaction.addEventListener('error', evt => {
			evt.preventDefault();
			transaction.abort();
			observer.onError(evt.target.error);
		});

		transaction.addEventListener('complete', observer.onCompleted.bind(observer));

		cb(store_obj, observer);
	});
}

function add_new_id(data, id, store) {
	if ( id === undefined && store['cfg'].keyType === 'uuid' ) {
		if ( store['cfg'].keyPath === undefined ) {
			id = uuid.v4();
		} else if ( data[store['cfg'].keyPath] === undefined ) {
			data[store['cfg'].keyPath] = uuid.v4();
		}
	}

	return id;
}

function clone_object(obj) {
	return Object.assign(new obj.constructor(), obj);
}
