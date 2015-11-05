import indexeddb from './indexeddb';
import fulltext from './fulltext';

let Rx = require('../lib/rxjs/dist/rx.all.js');

export default (db_name, version, index_store_name) => {
	let index = fulltext(),
		db = indexeddb(db_name, version),
		store_set = new Set();

	return {
		index(...args) {
			index.index(...args);
			return this;
		},
		store(...args) {
			store_set.add(args[0]);
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
										if ( store_set.has(store_name) ) {
											return new Store(store_name, index_store_name, db, index);
										}

										throw new Error('Store not found');
									}
								});
							});
					});
				}).then(resolve, reject);
		}
	};
}

class Store {
	constructor(name, index_store_name, db, index) {
		this['name'] = name;
		this['db'] = db;
		this['store'] = db.store_mut(name);
		this['index'] = index.get(name);
		this['index_store'] = db.store_mut(index_store_name);
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

	search(query, limit = null) {
		return Rx.Observable.create(observer => {
			let onError = observer.onError.bind(observer);

			if ( this['index'] === undefined ) {
				return onError(new Error('Store "' + this['name'] + '" has no index'));
			}

			this['index'].search(query, limit).toArray()
				.subscribe(index_result => {
					let score_map = new Map(),
						ref_array = [];

					for ( entry of index_result ) {
						score_map.set(entry.ref, entry.score);
						ref_array.push(entry.ref);
					}

					this['store'].get(ref_array)
						.subscribe(entry => {
							add_score(entry, score_map.get(entry.key()));
							observer.onNext(entry);
						}, onError, observer.onCompleted.bind(observer));
				}, onError)
		});
	}
}

function add_score(entry, score) {
	entry.score = () => {
		return score;
	};
}
