'use strict';

import {load_indexeddb} from './indexeddb';
import load_index from './index';

let _db = Symbol('db'),
	_name = Symbol('name'),
	_idx = Symbol('index');

export default function(name, version) {
	let store_list = [],
		db = load_indexeddb(name, version),
		index = load_index();

	return {
		store: function(name, cfg) {
			store_list.push(name);
			db.set(name, cfg);
			return this;
		},
		index: function(name, cfg) {
			index.set(name, cfg);
			return this;
		},
		then: (resolve, reject) => {
			return db
				.then(db_instance => {
					return index.then(index_map => {
						return store_list
							.map(name => {
								return new Store(name, db_instance, index_map.get(name) || null);
							})
							.reduce((map, store) => {
								map.set(store[_name], store);
								return map;
							}, new Map());
						});
				})
				.then(resolve, reject);
		}
	};
}

class Store {
	constructor(name, db, index) {
		this[_name] = name;
		this[_db] = db;
		this[_idx] = index;
	}

	get_db_transaction(...args) {
		return this[_db](this[_name], ...args);
	}

	search(query) {
		return new Promise((resolve, reject) => {
			if ( this[_idx] !== null ) {
				resolve(this[_idx].search(query));
			} else {
				reject(new Error('Index does not exist: ' + this[_name]));
			}
		})
			.then(result => {
				return this.get_db_transaction()
					.then(store => {
						let key_list = result
							.map((item, key) => {
								return key;
							})
							.reduce((list, item) => {
								list.push(item);
								return list;
							}, []);

						key_list.sort();

						return store
							.range('lowerupper', key_list[0], key_list[key_list.length -1])
							.cursor((cursor, result) => {
								if ( cursor !== null ) {
									let next_key = key_list.shift(),
										item = result.get(cursor.key);

									if ( item !== undefined ) {
										result.set(cursor.key, {score: item, value: cursor.value});
									}

									if ( next_key !== undefined ) {
										cursor.continue(next_key);
									}

								}
							}, result);
					});
			})
			.then(result => {
				return result.filter(item => {
					return item.value !== undefined;
				});
			});
	}

	rebuild_index() {
		return new Promise((resolve, reject) => {
			if ( this[_idx] !== null ) {
				resolve(this[_idx]);
			} else {
				reject(new Error('Index does not exist: ' + this[_name]));
			}
		})
			.then(index => {
				return index.clear()
					.then(() => {
						return this.get_db_transaction()
						.then(store => {
							return store.range();
						})
						.then(result => {
							return update_index(this[_idx], 'put', result);
						});
					});
			});
	}

	count(...args) {
		return this.get_db_transaction()
			.then(store => {
				return store.range().count(...args);
			});
	}

	get(...args) {
		return this.get_db_transaction()
			.then(store => {
				return store.get(...args);
			});
	}

	add(data) {
		return this.get_db_transaction('readwrite')
			.then(store => {
				return store.add(data);
			}).then(result => {
				return update_index(this[_idx], 'add', result);
			});
	}

	put(data) {
		return this.get_db_transaction('readwrite')
			.then(store => {
				return store.put(data);
			}).then(result => {
				return update_index(this[_idx], 'put', result);
			});
	}

	delete(key_list) {
		return this.get_db_transaction('readwrite')
			.then(store => {
				return store.delete(key_list);
			}).then(result => {
				return update_index(this[_idx], 'delete', result);
			});
	}

	clear() {
		return this.get_db_transaction('readwrite')
			.then(store => {
				return store.clear();
			})
			.then(() => {
				if ( this[_idx] !== null ) {
					return this[_idx].clear();
				}
			});
	}
}

function update_index(index, action, data) {
	if ( index === null ) {
		return data;
	} else {
		return Promise.all(data
			.map(item => {
				return index[action](item);
			})
			.reduce((list, item) => {
			   list.push(item);
			   return list;
			}, []))
			.then(() => {
				return data;
			});
		}
}

