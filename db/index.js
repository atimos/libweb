'use strict';

let lunr = require('../lib/lunr.js/lunr');

export default function() {
	let index_list = [];

	return {
		set: function(name, cfg) {
			index_list.push({name: name, cfg: cfg});
			return this;
		},
		then: (resolve, reject) => {
			let _index_list = index_list;
			index_list = [];
			return new Promise(resolve => {
				let index_map = _index_list
					.map(index => {
						return {
							name: index.name,
							index: lunr(function() {
								this.ref(index.cfg.ref);
								index.cfg.fields
									.map(field => {
										this.field(field.name, {boost: field.boost||0});
									});
							})
						};
					})
					.reduce((map, index) => {
						map.set(index.name, new Index(index.index));
						return map;
					}, new Map());

				resolve(index_map);
			}).then(resolve, reject);
		}
	};
}

class Index {
	constructor(index) {
		this.index = index;
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
			resolve(this.index.search(query));
		});
	}
}
