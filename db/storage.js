'use strict';
export class Storage {

	constructor(config) {
		this._config = config;
		this._dbinstance = null;
		this._range = null;
		this._store = null;
		this._index = null;
		this._direction = null;
		this._mode = null;
	}

	store(store_name) {
		this._store = store_name;
		return this;
	}

	mode(mode_name) {
		this._mode = mode_name;
		return this;
	}

	index(index_name) {
		this._index = index_name;
		return this;
	}

	direction(direction_name) {
		this._direction = direction_name;
		return this;
	}

	only(value) {
		this._range = window.IDBKeyRange.only(value);
		this._range.only = true;
		return this;
	}

	lower(lower_bound, exclude_lower) {
		this._range = window.IDBKeyRange.lowerBound(lower_bound, exclude_lower || false);
		return this;
	}

	upper(upper_bound, exclude_upper) {
		this._range = window.IDBKeyRange.upperBound(upper_bound, exclude_upper || false);
		return this;
	}

	lowerupper(lower_bound, upper_bound, exclude_lower, exclude_upper) {
		this._range = window.IDBKeyRange.bound(lower_bound, upper_bound, exclude_lower || false, exclude_upper || false);
		return this;
	}

	add(data) {
		return this._update_store('add', data);
	}

	put(data) {
		return this._update_store('put', data);
	}

	delete(data) {
		return this._update_store('delete', data);
	}

	get(id_list) {
		let id, range_type, range;

		if ( !Array.isArray(id_list) ) {
			id_list = [id_list];
			range_type = 'only';
		} else {
			range_type = 'lowerupper';
		}

		if ( id_list.length === 0 ) {
			return Promise.resolve([]);
		}

		id_list.sort();

		if ( this._direction === 'prev' || this._direction === 'prevunique' ) {
			id_list.reverse();
		}

		range = this[range_type](id_list[0], id_list[id_list.length - 1]);

		id = id_list.shift();
		return range.iterate((cursor, result) => {
			if ( id === cursor.key ) {
				if ( cursor.source.keyPath === null ) {
					cursor.value.__key = cursor.key;
				}
				result.push(cursor.value);
			}
			if ( id_list.length > 0 ) {
				id = id_list.shift();
				cursor.continue(id);
			}
		});
	}

	iterate(iteratee) {
		return this._db().then(db => {
			return new Promise((resolve, reject) => {
				let trans = db.transaction(this._store, this._mode || 'readonly'),
					store = trans.objectStore(this._store),
					result = [],
					cursor = null,
					one_result = (this._range === null?false:this._range.only || false);

				if ( this._index ) {
					store = store.index(this._index);
				}

				trans.addEventListener('complete', () => {
					if ( one_result === true ) {
						if ( result.length === 0 ) {
							resolve(null);
						} else {
							resolve(result.shift());
						}
					} else {
						resolve(result);
					}
				});

				trans.addEventListener('error', evt => {
					evt.preventDefault();
					trans.abort();
					reject(evt.target.error);
				});

				cursor = store.openCursor(this._range, this._direction || 'next');

				this._reset();

				cursor.addEventListener('success', evt => {
					let iteratee_result, key_name, cursor = evt.target.result;

					if ( cursor === undefined || cursor === null ) {
						return cursor;
					}


					if ( iteratee === undefined ) {
						if ( cursor.source.keyPath === null ) {
							cursor.value.__key = cursor.key;
						}

						result.push(cursor.value);

						if ( one_result !== true ) {
							cursor.continue();
						}
					} else {
						iteratee_result = iteratee(cursor, result, key_name);
					}
				});
			});
		});
	}

	_update_store(type, data) {
		return this._db().then(db => {
			return new Promise((resolve, reject) => {
				let multiple_inserts = Array.isArray(data),
					result = [],
					trans = db.transaction(this._store, this._mode || 'readwrite'),
					store = trans.objectStore(this._store);

				if ( !multiple_inserts ) {
					data = [data];
				}

				if ( this._index ) {
					store = store.index(this._index);
				}

				trans.addEventListener('complete',() => {
					if ( multiple_inserts ) {
						resolve(result);
					} else {
						resolve(result.pop());
					}
				});

				trans.addEventListener('error', evt => {
					evt.preventDefault();
					trans.abort();
					reject(evt.target.error);
				});

				this._reset();

				data.forEach(item => {
					let request = store[type](item);
					request.addEventListener('success', evt => {
						if ( evt.target.source.keyPath ) {
							item[evt.target.source.keyPath] = evt.target.result;
						} else {
							item.__key = evt.target.result;
						}
						result.push(item);
					});
				});
			});
		});
	}

	_reset() {
		this._index = null;
		this._mode = null;
		this._direction = null;
		this._range = null;
	}

	_db() {
		return new Promise((resolve, reject) => {
			if ( this._dbinstance !== null ) {
				resolve(this._dbinstance);
			} else if ( this._config === null ) {
				reject(Error('Database configuration is missing'));
			} else {
				let request;

				if ( this._config.version !== undefined ) {
					request = window.indexedDB.open(this._config.name, this._config.version);
				} else {
					request = window.indexedDB.open(this._config.name);
				}

				request.addEventListener('upgradeneeded', evt => {
					let db = evt.target.result;

					this._config.stores.forEach(store => {
						let object_store;
						if(db.objectStoreNames.contains(store.name)) {
							if ( store.options !== undefined ) {
								db.deleteObjectStore(store.name);
								object_store = db.createObjectStore(store.name, store.options);
							}
						} else {
							object_store = db.createObjectStore(store.name, store.options);
						}

						if ( store.index ) {
							store.index.forEach(index => {
								object_store.createIndex(index.name, index.keyPath || index.name, {unique: index.unique});
							});
						}
					});
				});

				request.addEventListener('success', evt => {
					this._dbinstance = evt.target.result;
					resolve(this._dbinstance);
				});

				request.addEventListener('error', evt => {
					evt.preventDefault();
					request.abort();
					reject(evt.target.error);
				});
			}
		});
	}
}

export function reset(db_name) {
	return new Promise((resolve, reject) => {
		let request = window.indexedDB.deleteDatabase(db_name);
		request.addEventListener('success', resolve);
		request.addEventListener('error', reject);
	});
}
