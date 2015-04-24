'use strict';

export function reset_fulltext_index(db, index, store_name) {
	return db(store_name)
		.then(store => {
			index.reset();
			return store
				.range()
				.cursor(cursor => {
					if ( cursor !== null ) {
						index.put(cursor.value);
						cursor.continue();
					}
				});
		})
		.then(() => {
			return index;
		});
}

export function load_fulltext_index(db, index, index_store_name) {
	return db(index_store_name)
		.then(store => {
		});
}

export function save_fulltext_index(db, index, index_store_name) {
	return db(index_store_name)
		.then(store => {
		});
}
