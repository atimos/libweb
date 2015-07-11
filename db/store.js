'use strict';

import indexeddb from './indexeddb';
import fulltext from './fulltext';

let Promise = require('../lib/bluebird/bluebird.js');
let Stream = require('../lib/streamjs/stream.js');

let _name = Symbol('name'),
	_db = Symbol('db'),
	_pipeline = Symbol('queue'),
	_store = Symbol('store'),
	_index_name = Symbol('index_name'),
	_dir = Symbol('direction'),
	_index_store_name = Symbol('idx_store_name'),
	_index = Symbol('index');

export const SCORE = Symbol('score');

export default function(db_name, index_store_name, version) {
	let index = fulltext(),
		db = indexeddb(db_name, version);

	return {
		index(name, cfg) {
			index.set(name, cfg);
			return this;
		},
		store(name, cfg) {
			db.set(name, cfg);
			return this;
		},
		then(resolve, reject) {
			return Promise.all([db, index])
				.then(result => {
					let [db, index] = result;

					if ( !index_store_name ) {
						return result;
					}

					return db.get(index_store_name)
						.then(store => {
							let work_queue = [];

							for ( let entry of index.entries() ) {
								let [name, index] = entry;

								work_queue.push(store.get(name)
									.then(index_data => {
										if ( index_data ) {
											return index.raw_set_data(index_data);
										}
									}));
							}

							return Promise.all(work_queue);
						})
						.then(() => {
							return result;
						});
				})
				.then(result => {
					let [db, index] = result;

					return {
						get(store_list) {
							if ( Array.isArray(store_list) ) {
								let store_map = new Map();

								store_list.forEach(store_name => {
									store_map.set(store_name, new Store(db, index, store_name, index_store_name));
								});

								return store_map;
							} else {
								return new Store(db, index, store_list, index_store_name);
							}
						},
						raw_index: index,
						raw_db: db
					};
				}).then(resolve, reject);
		}
	};
}

class Store {
	constructor(db, index, name, index_store_name) {
		this[_name] = name;
		this[_db] = db;
		this[_index_store_name] = index_store_name;
		this[_index] = index;
	}

	get(...args) {
		return this[_db].get(this[_name])
			.then(store => {
				return store.get(...args);
			});
	}

	iter(direction = 'next') {
		return new Iterator(this[_db].get(this[_name]), direction);
	}

	index(index_name) {
		return {
			get: (...args) => {
				return this[_db].get(this[_name])
					.then(store => {
						return store.index(index_name).get(...args);
					});
			},
			iter: (direction = 'next') => {
				return new Iterator(this[_db].get(this[_name]), direction, index_name);
			},
		};
	}

	put(items) {
		return update_store('put', this, items);
	}

	add(items) {
		return update_store('add', this, items);
	}

	delete(id_list) {
		return update_store('add', this, id_list);
	}

	clear() {
		return update_store('clear', this);
	}

	search(query, limit = 0, related = []) {
		return Promise.resolve()
			.then(() => {
				let work_queue = [];

				related.unshift(this[_name]);

				related.forEach(name => {
					if ( this[_index].has(name) === false ) {
						throw new Error('No index not found for: ' + name);
					}
					work_queue.push(this[_index].get(name).search(query));
				});

				return Promise.all(work_queue);
			})
			.then(result => {
				if ( result.length === 1 ) {
					return result.shift();
				} else {
					let work_queue = [],
						store_name = related.shift(),
						result_map = result.shift().toMap('ref');

					result.forEach((result, index) => {
						let item_list = result.toArray(),
							action = this[_db].get(related[index])
								.then(store => {
									return store.get(item_list.map(item => { return item.ref; }));
								})
								.then(result => {
									let index = -1;
									return result
										.filter_map(item => {
											index += 1;

											if ( item[store_name] === undefined ) {
												return false;
											}

											return {
												ref: item[store_name],
												score: item_list[index].score
											};
										});
								});

						work_queue.push(action);
					});

					return Promise.all(work_queue)
						.then(result_list => {
							result_list
								.forEach(result => {
									result
										.forEach(value => {
											if ( result_map.has(value.ref) ) {
												let item = result_map.get(value.ref);
												item.score += value.score;

												result_map.set(value.ref, item);
											} else {
												result_map.set(value.ref, value);
											}
										});
								});
							return new IterExt(result_map);
						});
				}
			})
			.then(result => {
				result = result.toArray();

				result
					.sort((a, b) => {
						return b.score - a.score;
					});

				if ( limit === 0 ) {
					return new IterExt(result);
				} else {
					return new IterExt(result.slice(0, limit));
				}
			})
			.then(result => {
				result = result.toArray();

				return this[_db].get(this[_name])
					.then(store => {
						return store.get(result.map(item => { return item.ref; }));
					})
					.then(items => {
						let index = -1;
						return items.map(item => {
							index += 1;
							item[SCORE] = result[index].score;
							return item;
						});
					});
			});
	}
}

function range_get_all(range) {
	let result = new Map();

	return range
		.cursor(cursor => {
			if ( cursor !== null ) {
				result.set(cursor.primaryKey, cursor.value);
				cursor.continue();
			}
		})
		.then(() => {
			return new IterExt(result);
		});
}

function update_store(action_type, store, items) {
	let db = store[_db],
		index = null,
		name = store[_name],
		index_store_name = store[_index_store_name];

	if ( store[_index].has(store[_name]) ) {
		index = store[_index].get(store[_name]);
	}

	return db.get(name, 'readwrite')
		.then(store => {
			let action = store[action_type](items);

			if ( index !== null ) {
				action = action.then(index[action_type](items));

				if ( index_store_name ) {
					action = action.then(() => {
						if ( action_type === 'clear' ) {
							return index.raw_get_data()
								.then(data => {
									return db.get(index_store_name, 'readwrite').delete(data.name);
								})
								.then(result => {
									return index.clear()
										.then(() => {
											return result;
										});
								});
						} else {
							return index.raw_get_data()
								.then(data => {
									return db.get(index_store_name, 'readwrite')
										.then(store => {
											return store.put(data);
										});
								});
						}
					});
				}
			}
			return action;
		});
}

class Iterator {
	constructor(store, direction) {
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
								entry = action(entry);
							}

							if ( entry !== null ) {
								result.set(entry.key, entry.value);
							}

							cursor.continue();
						}
					}, this[_dir])
					.then(() => {
						return result;
					});
			}).then(resolve, reject);
	}

	get_store() {
		return this[_store];
	}

	filter(fn) {
		this[_pipeline]
			.push(entry => {
				if ( entry !== null && fn(entry.value, entry.key) !== true ) {
					entry = null;
				}

				return entry;
			});

		return this;
	}

	map(fn) {
		this[_pipeline]
			.push(entry => {
				if ( entry !== null ) {
					entry.value = fn(entry.value, entry.key);
				}

				return entry;
			});

		return this;
	}
}

class IndexIterator extends Iterator {
	constructor(store, index_name, direction) {
		this[_store] = store;
		this[_dir] = direction;
		this[_index_name] = index_name;
		this[_pipeline] = [];
	}

	get_store() {
		return this[_store]
			.then(store => {
				return store.index(this[_index_name]);
			});
	}
}
