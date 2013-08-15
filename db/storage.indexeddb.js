(function(window, document, undefined) {
	'use strict';

	var lib = window.lib = window.lib || {};
	lib.db = lib.db || {};

	lib.db.storage = function(config, initcb) {
		var db, db_instance;

		function parseError(err) {
			switch ( Object.prototype.toString.call(err) ) {
			case '[object Event]':
				err = err.target.error;
				break;
			}
			return err;
		}

		function createStorage(evt) {
			(config.store || []).forEach(function(store_config) {
				var store = evt.currentTarget.result.objectStore(store_config.name, store_config.key);

				(store_config.index || []).forEach(function(index_config) {
					store.createIndex(index_config.name, index_config.keypath, index_config.options);
				});
				
			});
		}

		function loadTransaction(stores, access, cb) {
			var transaction = db_instance.transaction(stores, access);

			transaction.oncomplete = function(evt) {
				cb(parseError(evt), evt);
			};
			return transaction;
		}

		function loadStore(name, index, transaction) {
			var store = transaction.objectStore(name);

			if ( index ) {
				store = store.index(index);
			}

			return store;
		}

		function checkAgainstQuery(query, key, item) {
			return true;
		}

		function getItems(store_name, id_list, cb) {
			var transaction, store, result = [], not_found = [];
			try {
				transaction = loadTransaction(store_name, 'readonly', function(err) {
					cb(err, result, not_found);
				});

				store = loadStore(store_name, null, transaction);

				id_list.forEach(function(id) {
					store.get(id).onsuccess = function(evt) {
						if ( evt.target.result ) {
							result.push(evt.target.result);
						} else {
							not_found.push(id);
						}
					};
				});
			} catch ( err ) {
				if ( transaction ) {
					transaction.oncomplete = null;
					transaction.abort();
				}
				cb(parseError(err));
			}
		}

		function setItems(store_name, item_list, cb) {
			var result = [], transaction, store;
			try {
				transaction = loadTransaction(store_name, 'readwrite', function(err) {
					cb(err, result);
				});

				store = loadStore(store_name, null, transaction);

				item_list.forEach(function(item) {
					store.put(item).onsuccess = function(evt) {
						store.get(evt.target.result).onsuccess = function(evt) {
							result.push(evt.target.result);
						};
					};
				});
			} catch ( err ) {
				if ( transaction ) {
					transaction.oncomplete = null;
					transaction.abort();
				}
				cb(parseError(err));
			}
		}

		function deleteItems(store_name, id_list, cb) {
			var transaction, store;
			try {
				transaction = loadTransaction(store_name, 'readwrite', function(err) {
					cb(err);
				});

				store = loadStore(store_name, null, transaction);

				id_list.forEach(function(id) {
					store.delete(id);
				});
			} catch ( err ) {
				if ( transaction ) {
					transaction.oncomplete = null;
					transaction.abort();
				}
				cb(parseError(err));
			}
		}

		function queryDatabase(store_name, query, cb) {
			var transaction, result = [], range;
			try {
				transaction = loadTransaction(store_name, 'readonly', function(err) {
					cb(err, result);
				});

				if ( query.range) {
					range = window.IDBKeyRange[query.range.type].apply(window, query.range.value);
				}

				loadStore(store_name, query.index, transaction).openCursor(range, query.cursor || 'next').onsuccess = function(evt) {
					var cursor = evt.target.result, item;

					if ( cursor ) {
						if ( item === checkAgainstQuery(query, cursor.key, cursor.value) ) {
							result.push(cursor.value);
						}
						cursor.continue();
					}
				};

			} catch ( err ) {
				if ( transaction ) {
					transaction.oncomplete = null;
					transaction.abort();
				}
				cb(parseError(err));
			}
		}

		function loadDatabase(cb) {
			try {
				db = window.indexedDB.open(config.name, config.version);

				db.onsuccess = function(evt) {
					db_instance = evt.target.result;
					initcb(null, {
						get: getItems,
						set: setItems,
						del: deleteItems,
						query: queryDatabase,
						deleteDatabase: deleteDatabase,
						resetDatabase: resetDatabase
					});
				};
				db.onerror = function(evt) {
					initcb(parseError(evt));
				};
				db.onupgradeneeded = createStorage;
			} catch ( err ) {
				cb(parseError(err));
			}
		}

		function deleteDatabase() {
			try {
				window.indexedDB.deleteDatabase(config.name);
				return true;
			} catch ( err ) {
				return err;
			}
		}

		function resetDatabase(cb) {
			var deleted = deleteDatabase();
			if ( deleted === true ) {
				loadDatabase(function(err) {
					cb(err);
				});
			} else {
				cb(deleted);
			}
		}

		try {
			loadDatabase(initcb);
		} catch ( err ) {
			initcb(parseError(err));
		}
	};
}(window, window.document, void(0)));
