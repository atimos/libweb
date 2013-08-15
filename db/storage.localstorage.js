(function(window, document, undefined) {
	'use strict';

	var lib = window.lib = window.lib || {};
	lib.db = lib.db || {};

	lib.db.Storage = function(config, cb) {
		try {
			this.dbname = config.name;
			this.items = JSON.parse(window.localStorage.getItem(this.dbname) || '[]');

			setTimeout(function() {cb(null);});
		} catch ( err ) {
			setTimeout(function() {cb(err);});
		}
	};

	lib.db.Storage.prototype.get = function(id_list, cb) {
		var result;
		if ( id_list === undefined || id_list === null ) {
			result = this.items;
		} else {
			id_list = id_list.map(function(id) {
				if ( id.ref ) {
					return id.ref;
				}
				return id;
			});
			result = this.items.filter(function(item) {
				if ( id_list.indexOf(item.id) > -1 ) {
					return true;
				}
			});
		}
		setTimeout(function() {cb(null, result);});
	};

	lib.db.Storage.prototype.set = function(new_items, cb) {
		new_items.forEach(function(new_item) {
			var create_new = true;

			if ( !new_item.id ) {
				new_item.id = 'foo';
			}

			this.items = this.items.map(function(saved_item) {
				if ( new_item.id === saved_item.id ) {
					create_new = false;
					return new_item;
				} else {
					return saved_item;
				}
			});
			if ( create_new === true ) {
				this.items.push(new_item);
			}
		}.bind(this));

		window.localStorage.setItem(this.dbname, JSON.stringify(this.items));
		setTimeout(function() {cb(null, new_items);});
	};

	lib.db.Storage.prototype.del = function(items_to_delete, cb) {
		items_to_delete = items_to_delete.map(function(id) {
			if ( id.id ) {
				return id.id;
			}
			return id;

		});
		this.items = this.items.filter(function(item) {
			if ( items_to_delete.indexOf(item.id) === -1 ) {
				return true;
			}
		});

		window.localStorage.setItem(this.dbname, JSON.stringify(this.items));
		setTimeout(function() {cb(null);});
	};

	lib.db.Storage.prototype.query = function(query_object, cb) {
		var result = this.items.filter(function(item) {
			var field, query_item;
			for ( field in query_object ) {
				query_item = query_object[field];
				if ( Object.prototype.toString.call(query_item) === '[object Array]' ) {
					if ( query_item.indexOf(item[field]) > -1 ) {
						return true;
					}
				} else if ( query_item === item[field] ) {
					return true;
				}
			}
		});
		setTimeout(function() {cb(null, result);});
	};

	lib.db.Storage.prototype.reset = function(cb) {
		window.localStorage.setItem(this.dbname, '[]');
		this.items = [];
		setTimeout(function() {cb(null);});
	};

}(window, window.document, void(0)));
