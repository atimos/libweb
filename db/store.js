'use strict';

import {load_indexeddb} from './indexeddb';
import fulltext_index from './fulltext';

let Stream = require('../lib/streamjs/stream', 'es5');

export default function(name, index_store_name, version) {
	let index = fulltext_index(name, version),
		db = load_indexeddb(),
		index_db_cfg = new Map();

	return {
		index: function(name, cfg) {
			index_db_cfg.set(name, {name: name, store: cfg.store});
			index.set(name, cfg);
			return this;
		},
		store: function(name, cfg) {
			db.set(name, cfg);
			return this;
		},
		then: function(resolve, reject) {
			return Promise.all([db, index])
				.then(result => {
					let [db, index] = result,
						work_queue = [];

					for ( let entry of index.entries() ) {
						let [name, index] = entry;

						work_queue.push(fill_index(db, index, index_store_name, index_db_cfg.get(name)));
					}

					return Promise.all(work_queue)
						.then(() => {
							return [db, index];
						});
				}).then(result => {
					let [db, index] = result;

					return store_loader(db, index);
				}).then(resolve, reject);
		}
	};
}

function fill_index(db, index, store_name, cfg) {
	console.log(store_name);
	return db(store_name)
		.then(store => {
			return store.get(cfg.name);
		})
		.then(result => {
			if ( result !== null ) {
				return Stream([]);
			} else if ( cfg.store !== undefined ) {
				db(cfg.store)
					.then(store => {
						return store.range();
					});
			}

		})
		.then(result => {
			let work_queue = result.map(item => {
				index.put(item);
			}).toArray();

			return Promise.all(work_queue);
		});
}

function store_loader(db, index) {
	return function(store_list) {
		let return_map = Array.isArray(store_list);

		return db(store_list)
			.then(store => {
				if ( return_map === true ) {
					let store_map = new Map();

					for ( let entry of store.entries() ) {
						store_map.set(entry[0], new Store(entry[1], index.get(entry[0])));
					}

					return store_map;
				} else {
					return new Store(store, index.get(store_list));
				}
			});
	};
}

class Store {
	constructor(store, index) {
		this.store = store;
		this.index = index;
	}

	get(...args) {
		return this.store.get(...args);
	}

	range(...args) {
		return this.store.range(...args);
	}

	search(...args) {
		if ( this.index === null ) {
			return Stream([]);
		}
		/*
		let key_list = result
		.map((item, key) => {
			return key;
		})
		.reduce((list, item) => {
			list.push(item);
			return list;
		}, []);

		key_list.sort();
	   */

		/*
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
	   */

		return this.index.search(...args)
			.then(result => {
				result.flatMap('ref');

				let array = result.
					sort().toArray();

				console.log(array);
				return Stream([]);
				/*
				return Promise.all(result
					.map(item => {
						return this.db.get(item.ref);
					})
					.toArray()
				);
			   */
			});
	}

	put(data) {
		return this.store.put(Array.isArray(data)?data:[data])
			.then(result => {
				return Promise.all(result
					.map(item => {
						return this.index.put(item);
					})
					.toArray()
				);
			});
	}

	add(data) {
		return this.store.add(Array.isArray(data)?data:[data])
			.then(result => {
				return Promise.all(result
					.map(item => {
						return this.index.add(item);
					})
					.toArray()
				);
			});
	}

	delete(data) {
		return this.store.delete(Array.isArray(data)?data:[data])
			.then(result => {
				return Promise.all(result
					.map(item => {
						return this.index.delete(item);
					})
					.toArray()
				);
			});
	}
}
