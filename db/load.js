(function(window, document, undefined) {
	'use strict';

	var lib = window.lib = window.lib || {},
		path = document.querySelector('script[src*="db/load.js"]').src.slice(0, -8);

	lib.db.load = function(config, initcb) {
		var index, storage;

		if ( config.index ) {
			index = new lib.Worker(path + '/worker,js');
		}

		function setItems(storage_name, item_list, cb) {
			storage.set(storage_name, item_list, function(err, result) {
				if ( !err && index ) {
					index.send('is', result, function(err) {
						cb(err, result);
					});
				} else {
					cb(err, result);
				}
			});
		}

		function deleteItems(storage_name, id_list, cb) {
			storage.del(storage_name, id_list, function(err) {
				if ( !err && index ) {
					index.send('id', id_list, function(err) {
						cb(err);
					});
				} else {
					cb(err);
				}
			});
		}

		function deleteDatabase(cb) {
			storage.deleteDatabase(function(err) {
				if ( !err && index ) {
					index.send('dd', function(err) {
						cb(err);
					});
				}
			});
		}

		function resetDatabase(cb) {
			storage.resetDatabase(function(err) {
				if ( !err && index ) {
					index.send('rd', function(err) {
						cb(err);
					});
				}
			});
		}

		lib.db.storage(config.storage, function(err, instance) {
			storage = instance;
			var return_object = {
				get: storage.get,
				set: setItems,
				del: deleteItems,
				query: storage.query,
				resetDatabase: resetDatabase,
				deleteDatabase: deleteDatabase
			};
			if ( !err && config.index ) {
			} else {
				initcb(err, return_object);
			}
		});
	};
}(window, window.document, void(0)));
