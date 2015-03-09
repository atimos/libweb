'use strict';

import LwMap from '../lwmap/lwmap';

let lunr = require('../lib/lunr.js/lunr');

export default function() {
	let index_map = new LwMap();

	return {
		set: function(name, cfg) {
			index_map.set(name, cfg);
			return this;
		},
		then: (resolve, reject) => {
			return new Promise(resolve => {
				resolve(index_map.map(cfg => {
					return new Index(cfg);
				}));
			}).then(resolve, reject);
		}
	};
}

class Index {
	constructor(config) {
		this.config = config;

		this.index = lunr(function() {
			this.ref(config.ref);

			config.fields
				.map(field => {
					this.field(field.name, {boost: field.boost||0});
				});
		});
	}

	put(item) {
		return new Promise(resolve => {
			resolve(this.index.update(item));
		});
	}

	add(item) {
		return new Promise(resolve => {
			resolve(this.index.add(item));
		});
	}

	delete(id) {
		return new Promise(resolve => {
			resolve(this.index.remove({[this.index._ref]: id}));
		});
	}

	search(query) {
		return new Promise(resolve => {
			resolve(this.index.search(query)
				.reduce((result, item) => {
					result.set(item.ref, item.score);
					return result;
				}, new LwMap()));
		});
	}

	clear() {
		return new Promise(resolve => {
			let that = this;
			this.index = lunr(function() {
				this.ref(that.config.ref);

				that.config.fields
					.map(field => {
						this.field(field.name, {boost: field.boost||0});
					});
			});
			resolve();
		});
	}
}
