(function(self, undefined) {
	'use strict';
	self.importScripts(self.path + '/../db/lunr.js');
	var index, config;

	function create(config_object, cb) {
		config = config_object;
		index = self.lunr(function() {
			config.fields.forEach(function(name) {
				this.field(name);
			}.bind(this));
			this.ref(config.reference);
		});
		cb(null);
	}

	function search(search_string, cb) {
		cb(null, index.search(search_string));
	}

	function update(item_list, cb) {
		item_list.forEach(function(item) {
			if ( config.types.indexOf(item.type) > -1 ) {
				index.update(item);
			} else {
				index.remove({ref: item[config.reference]});
			}
		});
		cb(null);
	}

	function reset(cb) {
		create(config, cb);
	}

	self.on('r', reset);
	self.on('u', update);
	self.on('c', create);
	self.on('s', search);
}(self, void(0)));
