'use strict';

import LwMap from '../lwmap/lwmap';
import {load_indexeddb} from './indexeddb';
import load_index from './index';

let _db = Symbol('db'),
	_idx = Symbol('index');

export default function(name, version) {
	let db = load_indexeddb(name, version),
		index = load_index();

	return {
		store: function(name, cfg) {
			db.set(name, cfg);
			return this;
		},
		index: function(name, cfg) {
			index.set(name, cfg);
			return this;
		},
		then: (resolve, reject) => {
			return db.then(db_instance => {
				return index.then(index_map => {
					return new Store(db_instance, index_map.get(name) || null);
				});
			}).then(resolve, reject);
		}
	};
}

class Store {
	constructor(db, index) {
		this[_db] = db;
		this[_idx] = index;
	}

	get_db_transaction(store_name, ...args) {
		return this[_db](store_name, ...args);
	}

	search(store_name, query) {
		return new Promise((resolve, reject) => {
			if ( this[_idx] !== null ) {
				resolve(this[_idx].search(query));
			} else {
				reject(new Error('Index does not exist: ' + store_name));
			}
		}).then(result => {
			return this.get_db_transaction(store_name)
				.then(store => {
					let key_list;

					result = result
						.reduce((map, item) => {
							map.set(item.ref, item.ref);
							return map;
						}, new LwMap());

					key_list = result
						.map(item => {
							return item.ref;
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
								result.set(cursor.key, cursor.value);
								cursor.continue(key_list.shift());
							}
						}, result);
				});
		});
	}

	get(store_name, ...args) {
		return this.get_db_transaction(store_name)
			.then(store => {
				store.get(...args);
			});
	}

	add(store_name, data) {
		return this.get_db_transaction(store_name, 'readwrite')
			.then(store => {
				return store.add(data);
			}).then(result => {
				return update_index(this[_idx], 'add', result);
			});
	}

	put(store_name, data) {
		return this.get_db_transaction(store_name, 'readwrite')
			.then(store => {
				return store.put(data);
			}).then(result => {
				return update_index(this[_idx], 'put', result);
			});
	}

	delete(store_name, key_list) {
		return this.get_db_transaction(store_name, 'readwrite')
			.then(store => {
				return store.delete(key_list);
			}).then(result => {
				return update_index(this[_idx], 'delete', result);
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

