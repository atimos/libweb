'use strict';

import indexeddb from './indexeddb';
import fulltext from './fulltext';

let Promise = require('../lib/bluebird/bluebird.js');

let _name = Symbol('name'),
	_db = Symbol('db'),
	_index_store_name = Symbol('idx_store_name'),
	_index = Symbol('index');

export default function(db_name, index_store_name, version) {
	let index = fulltext(),
		db = indexeddb(db_name, version);

	return {
		index: function(name, cfg) {
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
						get: function(store_list) {
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
		this[_index] = index.get(name) || null;
	}

	get(...args) {
		return this[_db].get(this[_name])
			.then(store => {
				return store.get(...args);
			});
	}

	range(...args) {
		return this[_db].get(this[_name])
			.then(store => {
				return store.range(...args);
			});
	}

	put(items) {
		return update_store('put', this[_db], this[_index], this[_name], items, this[_index_store_name]);
	}

	add(items) {
		return update_store('add', this[_db], this[_index], this[_name], items, this[_index_store_name]);
	}

	delete(id_list) {
		return update_store('add', this[_db], this[_index], this[_name], id_list, this[_index_store_name]);
	}

	clear() {
		return update_store('clear', this[_db], this[_index], this[_name], this[_index_store_name]);
	}

	search(query) {
		if ( this[_index] === null ) {
			return Promise.reject(new Error('No index not found for: ' + this[_name]));
		}

		return this[_index].search(query)
			.then(result => {
				let key_list = [],
					last_key;

				if ( result.length === 0 ) {
					return [];
				}

				result = result
					.reduce((map, item) => {
						map.set(item.ref, null);
						key_list.push(item.ref);

						return map;
					}, new Map());

				key_list.sort();

				last_key = key_list[key_list.length -1];

				return this[_db].get(this[_name])
					.then(store => {
						return store.range('bound', key_list.shift(), last_key)
							.cursor(cursor => {
								if ( cursor !== null ) {
									let next_key = key_list.shift(),
										item = result.get(cursor.key);

									if ( item !== undefined ) {
										result.set(cursor.key, cursor.value);
									}

									if ( next_key !== undefined ) {
										cursor.continue(next_key);
									}
								}
							})
							.then(() => {
								let result_list = [];

								for ( let item of result.values() ) {
									result_list.push(item);
								}

								return result_list;
							});
					});
			});
	}
}

function update_store(action_type, db, index, name, items, idx_store_name) {
	return db.get(name, 'readwrite')
		.then(store => {
			let action = store[action_type](items);

			if ( index !== null ) {
				action = action.then(index[action_type](items));

				if ( idx_store_name ) {
					action = action.then(() => {
						if ( action_type === 'clear' ) {
							return index.raw_get_data()
								.then(data => {
									return db.get(idx_store_name, 'readwrite').delete(data.name);
								});
						} else {
							return index.raw_get_data()
								.then(data => {
									return db.get(idx_store_name, 'readwrite')
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
