'use strict';

import indexeddb from './indexeddb';
import fulltext from './fulltext';

let Rx = require('../lib/rxjs/dist/rx.all.js');

export default (db_name, version, index_store_name) => {
	let index = fulltext(),
		db = indexeddb(db_name, version);

	return {
		index(...args) {
			index.index(...args);
			return this;
		},
		store(...args) {
			db.store(...args);
			return this;
		},
		then(resolve, reject) {
			db.store(index_store_name, {});

			return Promise.all([db, index])
				.then(([db, index]) => {
					return new Promise((resolve, reject) => {
						db.store(index_store_name)
							.range()
							.cursor()
							.subscribe(entry => {
								if ( index.has(entry.key()) ) {
									index.get(entry.key()).from_raw(entry.raw())
								}
							}, reject, () => {
								resolve({
									store(store_name) {
										return new Store(store_name, db.store_mut(store_name), index.get(store_name), db.store_mut(index_store_name));
									}
								});
							});
					});
				}).then(resolve, reject);
		}
	};
}

class Store {
	constructor(name, store, index, index_store) {
		this['name'] = name;
		this['store'] = store;
		this['index'] = index;
		this['index_store'] = index_store;
	}

	get(...args) {
		return this['store'].get(...args);
	}

	range(...args) {
		return this['store'].range(...args);
	}

	put(...args) {
		if ( this['index'] ) {
			return this['store'].put(...args)
				.map(item => {
					return this['index'].put(args[0])
						.map(() => {
							return item;
						});
				})
				.concatAll()
				.doOnCompleted(() => {
					return Rx.Observable.fromPromise(new Promise((resolve, reject) => {
						this['index'].to_raw()
						.then(data => {
								this['index_store'].put(data, this['name']).subscribe(undefined, reject, resolve);
							})
					}));
				});
		} else {
			return this['store'].put(...args);
		}
	}

	post(...args) {
		if ( this['index'] ) {
			return this['store'].post(...args)
				.map(item => {
					return this['index'].post(args[0])
						.map(() => {
							return item;
						});
				})
				.concatAll()
				.doOnCompleted(() => {
					return Rx.Observable.fromPromise(new Promise((resolve, reject) => {
						this['index'].to_raw()
						.then(data => {
								this['index_store'].put(data, this['name']).subscribe(undefined, reject, resolve);
							})
					}));
				});
		} else {
			return this['store'].post(...args);
		}
	}

	delete(...args) {
		if ( this['index'] ) {
			return this['store'].delete(...args)
				.map(item => {
					return this['index'].delete(args[0])
						.map(() => {
							return item;
						});
				})
				.concatAll()
				.doOnCompleted(() => {
					return Rx.Observable.fromPromise(new Promise((resolve, reject) => {
						this['index'].to_raw()
						.then(data => {
								this['index_store'].put(data, this['name']).subscribe(undefined, reject, resolve);
							})
					}));
				});
		} else {
			return this['store'].post(...args);
		}
	}

	search(...args) {
		return this['index'].search(...args)
			.map(index_entry => {
				return this['store'].get(index_entry.ref)
					.map(store_entry => {
						return wrap_entry(store_entry, index_entry.score);
					});
			})
			.concatAll();
	}
}

function wrap_entry(entry, score) {
	let proxy = new Proxy(entry, {
		get: (target, name) => {
			if ( name === 'score' ) {
				return () => {
					return score;
				};
			} else {
				return entry[name];
			}
		},
	});
	return proxy;
}
