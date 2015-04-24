'use strict';

let Stream = require('../lib/streamjs/stream', 'es5'),
	Lunr = require('../lib/lunr.js/lunr', 'es5');

let _cfg = Symbol('cfg'),
	_index = Symbol('index');

export default function() {
	let index_map = new Map(), data_map = new Map();

	return {
		set: function(name, cfg, data = []) {
			data_map.set(name, data);
			index_map.set(name, cfg);
			return this;
		},
		then: (resolve, reject) => {
			return new Promise(resolve => {
				for ( let entry of index_map.entries() ) {
					let [name, cfg] = entry;
					let index = new Index(cfg);

					data_map
						.get(name)
						.forEach(item => {
							index.put(item);
						});

					index_map.set(name, index);
				}

				resolve(index_map);
			}).then(resolve, reject);
		}
	};
}

class Index {
	constructor(cfg) {
		this[_cfg] = cfg;
		this.reset();
	}

	put(item) {
		return new Promise(resolve => {
			resolve(this[_index].update(item));
		});
	}

	add(item) {
		return new Promise(resolve => {
			resolve(this[_index].add(item));
		});
	}

	delete(id) {
		return new Promise(resolve => {
			resolve(this.index.remove({[this[_index]._ref]: id}));
		});
	}

	search(query) {
		return new Promise(resolve => {
			resolve(Stream(this[_index].search(query)));
		});
	}

	reset() {
		let cfg = this[_cfg];

		this[_index] = Lunr(function() {
			this.ref(cfg.ref);

			cfg.fields
				.map(field => {
					this.field(field.name, {boost: field.boost||0});
				});
		});
	}
}
