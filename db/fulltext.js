'use strict';

import '../lib/lunr.js/lunr.min';

let lunr = $$$lib$lunr$js$lunr$min$$;

export function build_index(Transaction, db, cfg) {
	return new Promise(resolve => {
		let store_name_list = [], transaction, count = 0;

		let index_map = cfg.stores.filter(store => {
			if ( store.options.keyPath && Array.isArray(store.fulltext) ) {
				store_name_list.push({name: store.name});
				return true;
			}
		}).map(store => {
			return {
				name: store.name,
				index: lunr(function () {
					store.fulltext.forEach(name => {
						this.field(name);
					});

					this.ref(store.options.keyPath);
				})
			};
		}).reduce((index_map, index) => {
			index_map.set(index.name, index.index);

			return index_map;
		}, new Map());

		transaction = new Transaction(db, store_name_list);

		for ( let entry of index_map.entries() ) {
			count += 1;

			transaction.store(entry[0]).range().cursor(cursor => {
				entry[1].update(cursor.value);
				cursor.continue();
			}).then(() => {
				count -= 1;

				if ( count === 0 ) {
					resolve(index_map);
				}
			});
		}
	});
}
