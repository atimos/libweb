'use strict';

function load_db_instance() {
	return new Promise(function(resolve, reject) {
		if ( this.db !== null ) {
			resolve(this.db);
		} else if ( this.db_config === null ) {
			reject(Error('Database configuration is missing'));
		} else {
			var config = this.db_config, request;

			if ( config.version !== undefined ) {
		   		request = window.indexedDB.open(config.name, config.version);
			} else {
		   		request = window.indexedDB.open(config.name);
			}

			request.addEventListener('upgradeneeded', function(evt) {
				var db = evt.target.result;

				config.stores.forEach(function(store) {
					var object_store;
					if(db.objectStoreNames.contains(store.name)) {
						if ( store.options !== undefined ) {
							db.deleteObjectStore(store.name);
							object_store = db.createObjectStore(store.name, store.options);
						}
					} else {
						object_store = db.createObjectStore(store.name, store.options);
					}

					if ( store.index ) {
						store.index.forEach(function(index) {
							object_store.createIndex(index.name, index.keyPath || index.name, {unique: index.unique});
						});
					}
				});
			});

			request.addEventListener('success', function(evt) {
				this.db = evt.target.result;
				Object.freeze(this.db);
				resolve(this.db);
			}.bind(this));

			request.addEventListener('error', function(evt) {
				reject(evt.target.error);
			});
		}
	}.bind(this));
}

function update_store(type, data) {
	var store_name = this.store_name, index_name = this.index_name, mode_name = this.mode_name || 'readwrite';
	this.range = null;
	this.mode_name = null;
	this.direction_name = null;
	this.index_name = null;

	return load_db_instance.call(this).then(function(db) {
		return new Promise(function(resolve, reject) {
			var multiple_inserts = Array.isArray(data),
				result = [],
				trans = db.transaction(store_name, mode_name),
				store = trans.objectStore(store_name), index;

			if ( index_name ) {
				index = store.index(index_name);
			}

			trans.addEventListener('complete', function() {
				if ( multiple_inserts ) {
					resolve(result);
				} else {
					resolve(result.pop());
				}
			});

			trans.addEventListener('error', function(evt) {
				reject(evt.target.error);
			});

			if ( !multiple_inserts ) {
				data = [data];
			}

			data.forEach(function(item) {
				(index || store)[type](item).addEventListener('success', function(evt) {
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

function DbInstance() {}

DbInstance.prototype.store = function(store_name) {
	this.store_name = store_name;
	return this;
};

DbInstance.prototype.mode = function(mode_name) {
	this.mode_name = mode_name;
	return this;
};

DbInstance.prototype.index = function(index_name) {
	this.index_name = index_name;
	return this;
};

DbInstance.prototype.only = function(value) {
	this.range = window.IDBKeyRange.only(value);
	this.range.only = true;
	return this;
};

DbInstance.prototype.lower = function(lower_bound, exclude_lower) {
	this.range = window.IDBKeyRange.lowerBound(lower_bound, exclude_lower || false);
	return this;
};

DbInstance.prototype.upper = function(upper_bound, exclude_upper) {
	this.range = window.IDBKeyRange.upperBound(upper_bound, exclude_upper || false);
	return this;
};

DbInstance.prototype.lowerupper = function(lower_bound, upper_bound, exclude_lower, exclude_upper) {
	this.range = window.IDBKeyRange.bound(lower_bound, upper_bound, exclude_lower || false, exclude_upper || false);
	return this;
};

DbInstance.prototype.direction = function(direction) {
	this.direction_name = direction;
	return this;
};

DbInstance.prototype.add = function(data) {
	return update_store.call(this, 'add', data);
};

DbInstance.prototype.put = function(data) {
	return update_store.call(this, 'put', data);
};

DbInstance.prototype.del = function(data) {
	return update_store.call(this, 'delete', data);
};

DbInstance.prototype.iterate = function(iteratee) {
	var store_name = this.store_name, index_name = this.index_name, range = this.range, direction_name = this.direction_name || 'next', mode_name = this.mode_name || 'readonly';
	this.range = null;
	this.mode_name = null;
	this.direction_name = null;
	this.index_name = null;

	return load_db_instance.call(this).then(function(db) {
		return new Promise(function(resolve, reject) {
			var trans = db.transaction(store_name, mode_name),
				store = trans.objectStore(store_name),
				result = [], index;

			if ( index_name ) {
				index = store.index(index_name);
			}

			trans.addEventListener('complete', function() {
				if ( range !== null && range.only === true ) {
					if ( result.length === 0 ) {
						resolve(null);
					} else {
						resolve(result.shift());
					}
				} else {
					resolve(result);
				}
			});

			trans.addEventListener('error', function(evt) {
				reject(evt.target.error);
			});

			(index || store).openCursor(range, direction_name).addEventListener('success', function(evt) {
				var iteratee_result, key_name, cursor = evt.target.result;

				if ( cursor === undefined || cursor === null ) {
					return cursor;
				}


				if ( iteratee === undefined ) {
					if ( cursor.source.keyPath === null ) {
						cursor.value.__key = cursor.key;
					}

					result.push(cursor.value);

					if ( range === null || range.only !== true ) {
						cursor.continue();
					}
				} else {
					iteratee_result = iteratee(cursor, result, key_name);
				}
			});
		});
	});
};

DbInstance.prototype.get = function(id_list) {
	var id = null;

	if ( !Array.isArray(id_list) ) {
		return this.only(id_list).iterate();
	} else if ( id.length < 2 ) {
		return this.only(id_list[0]).iterate();
	} else {
		id_list.sort();

		if ( this.direction_name === 'prev' || this.direction_name === 'prevunique' ) {
			id_list.reverse();
		}

		return this.lowerupper(id_list[0], id_list[id_list.length - 1]).iterate(function(cursor, result) {
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
};

export function storage(config) {
	return Object.create(DbInstance.prototype, {
		db_config: { value: config },
		store_name: { writable: true, value: null },
		index_name: { writable: true, value: null },
		range: { writable: true, value: null },
		direction_name: { writable: true, value: null },
		mode_name: { writable: true, value: null },
		db: { writable: true, value: null }
	});
}

