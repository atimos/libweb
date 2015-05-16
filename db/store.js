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
												let item = result.map.get(value.ref);
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
				return this[_db].get(this[_name])
					.then(store => {
						return store.get(result.filter_map('ref').toArray());
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
