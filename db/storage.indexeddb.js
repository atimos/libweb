(function(window, document, undefined) {
	'use strict';

	var lib = window.lib = window.lib || {};
	lib.db = lib.db || {};

	lib.db.storage = function(config, initcb) {
		var db, db_instance;

		function createStorage(evt) {
			(config.store || []).forEach(function(store_config) {
				var store = evt.target.result.createObjectStore(store_config.name, store_config.key);

				(store_config.index || []).forEach(function(index_config) {
					store.createIndex(index_config.name, index_config.keypath, index_config.options);
				});
				
			});
		}

		function loadStore(store_name) {
			var transaction,
				action,
				index_name,
				store,
				access_name,
				result = [],
				not_found,
				item_list = [],
				sorted_items = [],
				cursor_fn,
				range_data,
				range_object,
				cursor_name,
				return_object;

			function runQuery(callback) {
				try {
					transaction = db_instance.transaction(store_name, access_name);

					transaction.onerror = function(evt) {
						if ( Object.prototype.toString.call(callback) === '[object Function]' ) {
							callback(evt.target.error, result, not_found);
						}
					};

					transaction.oncomplete = function(evt) {
						if ( Object.prototype.toString.call(callback) === '[object Function]' ) {
							callback(evt.target.error, result, not_found);
						}
					};

					store = transaction.objectStore(store_name);
					if ( index_name ) {
						store = store.index(index_name);
					}

					if ( action === 'get' ) {
						not_found = [];
						item_list.forEach(function(id) {
							store.get(id).onsuccess = function(evt) {
								if ( evt.target.result ) {
									result.push(evt.target.result);
								} else {
									not_found.push(id);
								}
							};
						});
					} else if ( action === 'delete' ) {
						result = undefined;
						item_list.forEach(function(id) {
							store.delete(id);
						});
					} else if ( action === 'add' ) {
						item_list.forEach(function(item) {
							store.add(item).onsuccess = function(evt) {
								store.get(evt.target.result).onsuccess = function(evt) {
									result.push(evt.target.result);
								};
							};
						});
					} else if ( action === 'put' ) {
						item_list.forEach(function(item) {
							store.put(item).onsuccess = function(evt) {
								store.get(evt.target.result).onsuccess = function(evt) {
									result.push(evt.target.result);
								};
							};
						});
					} else if ( action === 'cursor' ) {
						if ( range_data ) {
							range_object = window.IDBKeyRange[range_data.shift()].apply(window, range_data);
						}

						store.openCursor(range_object || undefined, cursor_name || 'next').addEventListener('success',function(evt) {
							if ( evt.target.result ) {
								if ( cursor_fn === undefined ) {
									result.push(evt.target.result.value);
									evt.target.result.continue();
								} else {
									var cursor_result = cursor_fn(evt.target.result.value);

									if ( cursor_result !== false ) {
										if ( cursor_result !== null && cursor_result !== undefined ) {
											result.push(cursor_result);
										}
										evt.target.result.continue();
									}
								}
							}
						});
					}
				} catch ( err ) {
					if ( transaction ) {
						transaction.oncomplete = null;
						transaction.abort();
					}
					if ( Object.prototype.toString.call(callback) === '[object Function]' ) {
						setTimeout(function() {callback(err);});
					}
				}
			}

			function get(items) {
				access_name = 'readonly';
				action = 'get';
				sorted_items = items.sort();
				item_list = items;
				return return_object;
			}

			function put(items) {
				access_name = 'readwrite';
				action = 'put';
				item_list = items;
				return return_object;
			}

			function add(items) {
				access_name = 'readwrite';
				action = 'add';
				item_list = items;
				return return_object;
			}

			function del(items) {
				access_name = 'readwrite';
				action = 'delete';
				item_list = items;
				return return_object;
			}

			function cursor(name, fn) {
				if ( Object.prototype.toString.call(name) === '[object Function]' ) {
					fn = name;
					name = undefined;
				}
				access_name = 'readonly';
				cursor_fn = fn;
				cursor_name = name;
				action = 'cursor';
				return return_object;
			}

			function index(name) {
				index_name = name;
				return return_object;
			}

			function range(type, lower, upper) {
				range_data = [type, lower, upper];
				return return_object;
			}

			function run(fn) {
				runQuery(fn);
			}

			return_object = {
				get: get,
				put: put,
				add: add,
				delete: del,
				cursor: cursor,
				index: index,
				range: range,
				run: run
			};
			return return_object;
		}

		function loadStorage(cb) {
			try {
				db = window.indexedDB.open(config.name, config.version);

				db.onsuccess = function(evt) {
					db_instance = evt.target.result;
					cb(null, {
						deleteStorage: deleteStorage,
						store: loadStore
					});
				};
				db.onerror = function(evt) {
					cb(evt.target.error);
				};
				db.onupgradeneeded = createStorage;
			} catch ( err ) {
				setTimeout(function() {cb(err);});
			}
		}

		function deleteStorage() {
			try {
				window.indexedDB.deleteDatabase(config.name);
				return true;
			} catch ( err ) {
				return err;
			}
		}

		try {
			loadStorage(initcb);
		} catch ( err ) {
			setTimeout(function() {initcb(err);});
		}
	};
}(window, window.document, void(0)));
