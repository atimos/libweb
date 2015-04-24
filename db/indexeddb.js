'use strict';

let Stream = require('../lib/streamjs/stream', 'es5');

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
					resolve(function(store_list, mode = 'readonly') {
						let return_map = Array.isArray(store_list);

						return new Promise(resolve => {
							resolve(return_map?store_list:[store_list]);
						})
							.then(store_list => {
								let transaction = evt.target.result.transaction(store_list, mode);

								if ( return_map === false ) {
									return new Store(transaction, store_list[0]);
								} else {
									return store_list
										.map(name => {
											return {name: name, store: new Store(transaction, name)};
										})
										.reduce((map, store) => {
											map.set(store.name, store.store);
											return map;
										}, new Map());
								}
							});
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
		return update_database(this[_trans], this[_name], 'add', data);
	}

	put(data) {
		return update_database(this[_trans], this[_name], 'put', data);
	}

	delete(key_list) {
		return update_database(this[_trans], this[_name], 'delete', key_list);
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

	cursor(fn, direction = 'next') {
		return new Promise((resolve, reject) => {
			let result = [];

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
		return this
			.cursor((cursor, result) => {
				if ( cursor !== null ) {
					result.push(cursor.value);
					cursor.continue();
				}
			})
			.then(result => {
				console.log(result.size());
				return Stream(result);
			}, reject);
	}
}

class IndexRange extends Range {
	keyCursor(fn, direction = 'next') {
		return new Promise((resolve, reject) => {
			let result = [];

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
			resolve(Stream(result));
		});
	}
}

function update_database(transaction, store_name, action, data) {
	return new Promise((resolve, reject) => {
		let store = transaction.objectStore(store_name),
			result = [], array_result = Array.isArray(data);

		if ( array_result ) {
			add_transaction_handler(transaction, resolve, reject, result);
		} else {
			add_transaction_handler(transaction, resolve, reject);

			data = [data];
		}

		if ( action === 'delete' ) {
			data.forEach(key => {
				store[action](key).addEventListener('success', () => {
					if ( array_result ) {
						result.push(key);
					} else {
						resolve(key);
					}
				});
			});
		} else {
			data.forEach(item => {
				store[action](item).addEventListener('success', evt => {
					item[evt.target.source.keyPath] = evt.target.result;

					if ( array_result ) {
						result.push(item);
					} else {
						resolve(item);
					}
				});
			});
		}
	});
}
