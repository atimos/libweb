'use strict';

let Promise = require('../lib/bluebird/bluebird.js');

let _store = Symbol('store'),
	_trans = Symbol('trans'),
	_index = Symbol('index'),
	_range = Symbol('range');

export default function(name, version) {
	let config_map = new Map();

	return {
		set: function(name, config) {
			config_map.set(name, config);
			return this;
		},
		then: (resolve, reject) => {
			return new Promise((resolve, reject) => {
				let request;

				if ( version !== undefined ) {
					request = window.indexedDB.open(name, version);
				} else {
					request = window.indexedDB.open(name);
				}

				request.addEventListener('upgradeneeded', evt => {
					for ( let entry of config_map.entries() ) {
						let [name, options] = entry,
							index = options.index || [],
							store = null;

						if ( evt.target.result.objectStoreNames.contains(name) ) {
							evt.target.result.deleteObjectStore(name);
						}

						store = evt.target.result.createObjectStore(name, options);

						index
							.forEach(config => {
								store.createIndex(config.name, config.keyPath || config.name, config);
							});
					}
				});

				request.addEventListener('success', evt => {
					resolve({
						has: function(store_name) {
							return (evt.target.objectStoreNames[store_name] !== undefined);
						},
						get: function(store_list, mode = 'readonly') {
							return new Promise(resolve => {
								let transaction = evt.target.result.transaction(Array.isArray(store_list)?store_list:[store_list], mode);

								if ( Array.isArray(store_list) ) {
									let store_map = new Map();

									store_list
										.forEach(name => {
											store_map.set(name, new Store(transaction.objectStore(name)));
										});

									resolve(store_map);
								} else {
									resolve(new Store(transaction.objectStore(store_list)));
								}
							});
						},
						delete_database: function() {
							return new Promise((resolve, reject) => {
								var request = window.indexedDB.deleteDatabase(name);

								request.addEventListener('success', resolve);

								request.addEventListener('error', evt => {
									reject(evt.target.error);
								});
							});
						}
					});
				});

				request.addEventListener('error', evt => {
					evt.preventDefault();
					reject(evt.target.error);
				});
			}).then(resolve, reject);
		}
	};
}

class Store {
	constructor(store) {
		this[_store] = store;
	}

	index(name) {
		return new Index(this[_store].index(name));
	}

	get(key) {
		return new Promise((resolve, reject) => {
			add_transaction_handler(this[_store].transaction, reject);

			this[_store].get(key)
				.addEventListener('success', evt => {
					resolve(evt.target.result);
				});
		});
	}

	range(...args) {
		return new Range(this[_store].transaction, this[_store], ...args);
	}

	add(items) {
		return update_store(this[_store], 'add', items);
	}

	put(items) {
		return update_store(this[_store], 'put', items);
	}

	delete(key_list) {
		return update_store(this[_store], 'delete', key_list);
	}

	clear() {
		return new Promise((resolve, reject) => {
			add_transaction_handler(this[_store].transaction, reject);

			this[_store].clear()
				.addEventListener('success', evt => {
					resolve(evt.target.result);
				});
		});
	}
}

class Index {
	constructor(index) {
		this[_index] = index;
	}

	get(key) {
		return new Promise((resolve, reject) => {
			add_transaction_handler(this[_index].objectStore.transaction, reject);

			this[_index].get(key)
				.addEventListener('success', evt => {
					resolve(evt.target.result);
				});
		});
	}

	getKey(key) {
		return new Promise((resolve, reject) => {
			add_transaction_handler(this[_index].objectStore.transaction, reject);

			this[_index].getKey(key)
				.addEventListener('success', evt => {
					resolve(evt.target.result);
				});
		});
	}

	range(...args) {
		return new IndexRange(this[_index].objectStore.transaction, this[_index], ...args);
	}
}

class Range {
	constructor(transaction, store, type, ...args) {
		this[_store] = store;
		this[_trans] = transaction;

		switch ( type ) {
			case 'only':
				this[_range] = window.IDBKeyRange.only(...args);
				break;
			case 'lower_bound':
				this[_range] = window.IDBKeyRange.lowerBound(args.shift(), args.shift() || false);
				break;
			case 'upper_bound':
				this[_range] = window.IDBKeyRange.upperBound(args.shift(), args.shift() || false);
				break;
			case 'bound':
				this[_range] = window.IDBKeyRange.bound(args.shift(), args.shift(), args.shift() || false, args.shift() || false);
				break;
			default:
				this[_range] = null;
		}
	}

	cursor(fn, direction = 'next') {
		return new Promise((resolve, reject) => {
			add_transaction_handler(this[_trans], reject, resolve);

			this[_store].openCursor(this[_range], direction)
				.addEventListener('success', evt => {
					fn(evt.target.result || null);
				});
		});
	}

	count() {
		return new Promise((resolve, reject) => {
			add_transaction_handler(this[_trans], reject);

			this[_store].count(this[_range])
				.addEventListener('success', evt => {
					resolve(evt.target.result);
				});
		});
	}

	then(resolve, reject) {
		let result = [];

		return this
			.cursor(cursor => {
				if ( cursor !== null ) {
					result.push(cursor.value);
					cursor.continue();
				}
			})
			.then(() => {
				return result;
			})
			.then(resolve, reject);
	}
}

class IndexRange extends Range {
	keyCursor(fn, direction = 'next') {
		return new Promise((resolve, reject) => {
			let result = [];

			add_transaction_handler(this[_trans], reject, resolve, result);

			this[_store].openKeyCursor(this[_range], direction)
				.addEventListener('success', evt => {
					fn(evt.target.result || null, result);
				});
		});
	}
}

function update_store(store, action, items) {
	return new Promise((resolve, reject) => {
		let result;

		if ( Array.isArray(items) ) {
			result = [];
			add_transaction_handler(store.transaction, reject, resolve, result);
		} else {
			result = null;
			add_transaction_handler(store.transaction, reject);
		}

		if ( Array.isArray(items) ) {
			if ( action === 'delete' ) {
				items.forEach(key => {
					store[action](key).addEventListener('success', () => {
						result.push(key);
					});
				});
			} else {
				items.forEach(item => {
					store[action](item).addEventListener('success', evt => {
						item[evt.target.source.keyPath] = evt.target.result;
						result.push(item);
					});
				});
			}
		} else {
			store[action](items).addEventListener('success', evt => {
				if ( action !== 'delete' ) {
					items[evt.target.source.keyPath] = evt.target.result;
				}
				resolve(items);
			});
		}
	});
}

function add_transaction_handler(transaction, reject, resolve = null, result = null) {
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
