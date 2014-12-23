'use strict';

import '../lib/lunr.js/lunr.min';

let lunr = $$$lib$lunr$js$lunr$min$$;

export function build_index(db, cfg) {
	let index_map = new Map();

	return Promise.all(cfg.map(store => {
		return new Promise(resolve => {
			let index = new Index(lunr(function () {
				store.fields.forEach(name => {
					this.field(name);
				});
				this.ref(store.ref);
			}));

			return db.store(store.name).range().cursor(cursor => {
				index.put(cursor.value);
				cursor.continue();
			}).then(() => {
				index_map.set(store.name, index);
				resolve();
			});
		});
	})).then(() => {
		return index_map;
	});
}

class Index {
	constructor(index) {
		this.index = index;
	}

	put(item) {
		return this.index.update(item);
	}

	add(item) {
		return this.index.add(item);
	}

	delete(item) {
		return this.index.remove(item);
	}

	search(query) {
		return this.index.search(query);
	}
}
