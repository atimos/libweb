'use strict';

import indexeddb from './indexeddb';
import fulltext from './fulltext';
import IterExt from '../iterext/iterext';

let Promise = require('../lib/bluebird/bluebird.js');

let _name = Symbol('name'),
	_db = Symbol('db'),
	_queue = Symbol('queue'),
	_store = Symbol('store'),
	_index_name = Symbol('index_name'),
	_dir = Symbol('direction'),
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
			})
			.then(result => {
				if ( Array.isArray(result) ) {
					return new IterExt(result);
				}

				return result;
			});
	}

	iter(direction = 'next') {
		return new Iterator(this[_db].get(this[_name]), direction);
	}

	range(...range_args) {
		return {
			cursor: (...args) => {
				return this[_db].get(this[_name])
					.then(store => {
						return store.range(...range_args).cursor(...args);
					});
			},
			count: () => {
				return this[_db].get(this[_name])
					.then(store => {
						return store.range(...range_args).count();
					});
			},
			then: (resolve, reject) => {
				return this[_db].get(this[_name])
					.then(store => {
						return range_get_all(store.range(...range_args));
					}).then(resolve, reject);
			}
		};
	}

	index(...args_index) {
		return {
			get: (...args) => {
				return this[_db].get(this[_name])
					.then(store => {
						return store.index(...args_index).get(...args);
					});
			},
			getKey: (...args) => {
				return this[_db].get(this[_name])
					.then(store => {
						return store.index(...args_index).getKey(...args);
					});
			},
			iter: (direction = 'next') => {
				return new Iterator(this[_db].get(this[_name]), direction, ...args_index);
			},
			range: (...range_args) => {
				return {
					keyCursor: (...args) => {
						return this[_db].get(this[_name])
							.then(store => {
								return store.index(...args_index).range(...range_args).keyCursor(...args);
							});
					},
					cursor: (...args) => {
						return this[_db].get(this[_name])
							.then(store => {
								return store.index(...args_index).range(...range_args).cursor(...args);
							});
					},
					count: () => {
						return this[_db].get(this[_name])
							.then(store => {
								return store.index(...args_index).range(...range_args).count();
							});
					},
					then: (resolve, reject) => {
						return this[_db].get(this[_name])
							.then(store => {
								return range_get_all(store.index(...args_index).range(...range_args));
							});
					}
				};
			}
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
										item = result.get(cursor.primaryKey);

									if ( item !== undefined ) {
										result.set(cursor.primaryKey, cursor.value);
									}

									if ( next_key !== undefined ) {
										cursor.continue(next_key);
									}
								}
							})
							.then(() => {
								return new IterExt(result);
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
		index = store[_index],
		name = store[_name],
		index_store_name = store[_index_store_name];

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
		})
		.then(result => {
			if ( Array.isArray(result) ) {
				return new IterExt(result);
			}

			return result;
		});
}

class Iterator {
	constructor(store, direction, index_name) {
		this[_store] = store;
		this[_index_name] = index_name;
		this[_dir] = direction;
		this[_queue] = [];
	}

	then(resolve, reject) {
		return this[_store]
			.then(store => {
				let result = new Map();

				if ( this[_index_name] !== undefined ) {
					store = store.index(this[_index_name]);
				}

				return store.range()
					.cursor(cursor => {
						if ( cursor ) {
							let entry = {key: cursor.primaryKey, value: cursor.value, done: false};

							for ( let action of this[_queue] ) {
								entry = action(entry);
							}

							if ( entry !== undefined && entry.done === false ) {
								result.set(entry.key, entry.value);
							}

							if ( entry === undefined || entry.done === false ) {
								cursor.continue();
							}
						}
					}, this[_dir])
					.then(() => {
						return new IterExt(result);
					});
			}).then(resolve, reject);
	}

	map(fn) {
		this[_queue]
			.push(entry => {
				if ( entry !== undefined ) {
					entry.value = fn(entry.value, entry.key);
				}

				return entry;
			});

		return this;
	}

	filter(fn) {
		this[_queue]
			.push(entry => {
				if ( entry !== undefined && fn(entry.value, entry.key) !== true ) {
					entry = undefined;
				}

				return entry;
			});

		return this;
	}

	filter_map(fn) {
		if ( Object.prototype.toString.call(fn) === '[object Function]' ) {
			this[_queue].push(entry => {
				if ( entry !== undefined ) {
					entry.value = fn(entry.value, entry.key);

					if ( entry.value === null ) {
						entry = undefined;
					}
				}

				return entry;
			});
		} else {
			this[_queue].push(entry => {
				if ( entry !== undefined ) {
					if ( Object.prototype.toString.call(entry.value) === '[object Map]' ) {
						if ( entry.value.has(fn) ) {
							entry.value = entry.value.get(fn);
						} else {
							entry = undefined;
						}
					} else {
						if ( entry.value.hasOwnProperty(fn) ) {
							entry.value = entry.value[fn];
						} else {
							entry = undefined;
						}
					}
				}

				return entry;
			});
		}

		return this;
	}

	skip(n = 1) {
		this.filter(() => {
			if ( n > 0 ) {
				n -= 1;
				return false;
			} else {
				return true;
			}
		});

		return this;
	}

	skip_while(fn) {
		this.filter((item, index) => {
			return !fn(item, index);
		});

		return this;
	}

	take(n) {
		this.take_while(() => {
			if ( n === 0 ) {
				return false;
			}

			n -= 1;

			return true;
		});

		return this;
	}

	take_while(fn) {
		this[_queue]
			.push(entry => {
				if ( entry !== undefined && fn(entry.value, entry.key) !== true ) {
					entry.done = true;
				}

				return entry;
			});

		return this;
	}
}
