'use strict';

import indexeddb from './indexeddb';
import fulltext from './fulltext';

let Promise = require('../lib/bluebird/bluebird.js'),
	Stream = require('../lib/streamjs/stream.js');

let _name = Symbol('name'),
	_db = Symbol('db'),
	_pipeline = Symbol('queue'),
	_store = Symbol('store'),
	_index_name = Symbol('index_name'),
	_dir = Symbol('direction'),
	_index = Symbol('index');

export const SCORE = Symbol('score');

export default function(db_name, version, index_store_name = null) {
	let index = fulltext(),
		db = indexeddb(db_name, version);

	return {
		set(name, cfg) {
			db.set(name, cfg);

			if ( Array.isArray(cfg.fulltext) && cfg.key !== undefined ) {
				index.set(name, {
					ref: cfg.key,
					fields: cfg.fulltext
				});
			}

			return this;
		},
		then(resolve, reject) {
			return Promise.all([db, index])
				.then(result => {
					let [db, index] = result;

					if ( index_store_name !== null ) {
						return db.load([index_store_name])
							.then(store => {
								let work_queue = [];

								store = store.get(index_store_name);

								for ( let [name, index] of index.entries() ) {
									work_queue.push(store.get([name])
										.then(index_data => {
											index_data.getFirst().ifPresent(item => {
												return index.raw_set_data(index_data);
											});
										}));
								}

								return Promise.all(work_queue);
							})
							.then(() => {
								return result;
							});
					}

					return result;
				})
				.then(result => {
					let [db, index] = result;

					return {
						get(store_list) {
							let store_map = new Map();

							if ( !Array.isArray(store_list) ) {
								store_list = [store_list];
							}

							store_list.forEach(store_name => {
								store_map.set(store_name, new Store(store_name, db, index, index_store_name));
							});

							return store_map;
						},
						index: index,
						db: db
					};
				}).then(resolve, reject);
		}
	};
}

class Store {
	constructor(name, db, index, index_name) {
		this[_name] = name;
		this[_db] = db;
		this[_index_name] = index_name;
		this[_index] = index;
	}

	get(item) {
		return this[_db].load([this[_name]])
			.then(store => {
				return store.get(this[_name]).get([item])
					.then(result => {
						result.getFirst().orElse(null);
					});
			});
	}

	iter(direction = 'next') {
		return new Iterator(direction, this);
	}

	index(index_name) {
		return {
			get: (item) => {
				return this[_db].load([this[_name]])
					.then(store => {
						return store.get(this[_name]).index(index_name).get([item]);
							.then(result => {
								result.getFirst().orElse(null);
							});
					});
			},
			iter: (direction = 'next') => {
				return new IndexIterator(direction, this, index_name);
			},
		};
	}

	put(items) {
		return update_store('put', items, this);
	}

	add(items) {
		return update_store('add', items, this);
	}

	delete(id_list) {
		return update_store('add', id_list, this);
	}

	clear() {
		let store_list = [this[_name]];

		if ( this[_index_name] ) {
			store_list.push(this[_index_name]);
		}

		return this[_db].load(store_list)
			.then(store_list => {
				let work_queue = [store_list.get(this[_name]).clear()];

				if ( this[_index_name] ) {
					work_queue.push(store_list.get(this[_index_name]).delete(this[_name]));
				}

				if ( this[_index].has(name) === true ) {
					work_queue.push(this[_index].get(name).clear());
				}

				return Promise.all(work_queue);
			})
			.then(() => {
				return;
			});

	}

	search(query, limit = 0) {
		let store_name = this[_name];

		return new Promise((resolve, reject) => {
			if ( this[_index].has(store_name) === false ) {
				reject(new Error('No fulltext search index not found for: ' + store_name));
			} else {
				resolve(this[_index].get(store_name).search(query));
			}
		})
			.then(search_result => {
				if ( limit > 0 ) {
					return search_result.limit(limit);
				} else {
					return search_result;
				}
			});
			.then(search_result => {
				let result_map = new Map();

				return this[_db].load([store_name])
					.then(store => {
						store = store.get(store_name);
						let work_queue = [];

						for ( let item of search_result ) {
							result_map.set(item.ref, null);

							work_queue.push(store.get([item.ref])
								.then(store_item => {
									store_item.findFirst().ifPresent(item => {
										store_item[SCORE] = item.score;
										result_map.set(item.ref, store_item);
									});
								}));
						}

						return Promise.all(work_queue)
							.then(() => {
								return Stream(result_map);
							});
					});
			});
}

function update_store(action_type, items, store) {
	let store_list = [store[_name]];

	if ( !Array.isArray(items) ) {
		items = [items];
	}

	if ( this[_index_name] ) {
		store_list.push(this[_index_name]);
	}

	return db.load(store_list, 'readwrite')
		.then(store_list => {
			let work_queue = [store[action_type](items)];

			if ( store[_index].has(store[_name]) ) {
				let index = store[_index].get(store[_name]);
				work_queue.push(index[action_type](items)
					.then(() => {
						if ( store[_index_name] ) {
							return index.raw_get_data()
								.then(store_list.get(store[_index_name]).put);
						}
					}));
			}

			return Promise.all(work_queue);
		})
		.then(() => {
			return;
		});
}

class Iterator {
	constructor(direction, store) {
		this[_store] = store;
		this[_dir] = direction;
		this[_pipeline] = [];
	}

	then(resolve, reject) {
		return this.get_store()
			.then(store => {
				let result = new Map();

				return store.range()
					.cursor(cursor => {
						if ( cursor ) {
							let entry = {key: cursor.primaryKey, value: cursor.value};

							for ( let action of this[_pipeline] ) {
								if ( entry === null ) {
									break;
								}

								entry = action(entry);
							}

							if ( entry !== null ) {
								result.set(entry.primaryKey, entry.value);
							}

							cursor.continue();
						}
					}, this[_dir])
					.then(() => {
						return Stream(result);
					});
			}).then(resolve, reject);
	}

	get_store() {
		return this[_store][_db].load([this[_store][_name]])
			.then(store => {
				return store.get(this[_store][_name]);
			});
	}

	filter(fn) {
		this[_pipeline]
			.push(entry => {
				return (fn(entry.value, entry.key) === true ? entry : null);
			});

		return this;
	}

	map(fn) {
		this[_pipeline]
			.push(entry => {
				entry.value = fn(entry.value, entry.key);

				return entry;
			});

		return this;
	}
}

class IndexIterator extends Iterator {
	constructor(direction, store, index_name) {
		this[_store] = store;
		this[_dir] = direction;
		this[_pipeline] = [];
		this[_index_name] = index_name;
	}

	get_store() {
		return this[_store][_db].load([this[_store][_name]])
			.then(store => {
				return store.get(this[_store][_name]).index(this[_index_name]);
			});
	}
}
