'use strict';

export var events = {
	create:	function() {
		var events = {};

		return {
			trigger: function(name, data) {
				if ( Array.isArray(events[name]) ) {
					events[name].forEach(function(fn) {
						fn(data);
					});
				}
			},
			on: function(name, fn) {
				if ( !Array.isArray(events[name]) ) {
					events[name] = [];
				}
				events[name].push(fn);
			}
		};
	}
};
