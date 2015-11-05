import indexeddb from './indexeddb';
import fulltext from './fulltext';
import Rx from '../rxjs/rxjs';

export default (db_name, version, index_store_name) => {
	let index = fulltext(),
		db = indexeddb(db_name, version),
		store_set = new Set();

	return {
		fulltext(...args) {
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
									index.get(entry.key()).from_raw(entry.to_raw()).subscribe();
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
		this['index'] = index.get(name);
		this['index_store'] = db.store_mut(index_store_name);
		
	}

	get(...args) {
		return this['db'].store(this['name']).get(...args);
	}

	range(...args) {
		return this['db'].store(this['name']).range(...args);
	}

	put(...args) {
		let action = this['db'].store_mut(this['name']).put(...args);

		if ( this['index'] ) {
				action.map(entry => {
					return this['index'].put(args[0])
						.map(() => {
							return entry;
						});
				})
				.concatAll()
				.doOnCompleted(() => {
					return Rx.Observable.fromPromise(new Promise((resolve, reject) => {
						this['index'].to_raw()
						.subscribe(data => {
								this['index_store'].put(data, this['name']).subscribe(undefined, reject, resolve);
							})
					}));
				});
		}

		return action;
	}

	post(...args) {
		let action = this['db'].store_mut(this['name']).post(...args);

		if ( this['index'] ) {
				action.map(entry => {
					return this['index'].post(args[0])
						.map(() => {
							return entry;
						});
				})
				.concatAll()
				.doOnCompleted(() => {
					return Rx.Observable.fromPromise(new Promise((resolve, reject) => {
						this['index'].to_raw()
						.subscribe(data => {
								this['index_store'].put(data, this['name']).subscribe(undefined, reject, resolve);
							})
					}));
				});
		}

		return action;
	}

	delete(...args) {
		let action = this['db'].store_mut(this['name']).delete(...args);

		if ( this['index'] ) {
				action.map(entry => {
					return this['index'].delete(args[0])
						.map(() => {
							return entry;
						});
				})
				.concatAll()
				.doOnCompleted(() => {
					return Rx.Observable.fromPromise(new Promise((resolve, reject) => {
						this['index'].to_raw()
						.subscribe(data => {
								this['index_store'].put(data, this['name']).subscribe(undefined, reject, resolve);
							})
					}));
				});
		}

		return action;
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

					this['db'].store(this['name']).get(ref_array)
						.subscribe(entry => {
							add_score(entry, score_map.get(entry.key()));
							observer.onNext(entry);
						}, onError, observer.onCompleted.bind(observer));
				}, onError)
		});
	}

	clear() {
		return Rx.Observable.create(observer => {
			this['index'].clear()
				.subscribe(() => {
					this['db'].clear_store(this['name'])
						.subscribe(() => {
							this['index_store'].delete(this['name'])
								.subscribe(
									observer.onNext.bind(observer),
									observer.onError.bind(observer),
									observer.onCompleted.bind(observer)
								);
						}, observer.onError.bind(observer));
				}, observer.onError.bind(observer));
		});
	}

	rebuild_index() {
		return Rx.Observable.create(observer => {
			let onError = observer.onError.bind(observer);

			this['index'].clear()
				.subscribe(() => {
					this['db'].store(this['name']).range().cursor()
						.map(entry => {
							return entry.to_raw()
						})
						.toArray()
						.map(list => {
							return this['index'].post_list_transaction(list);
						})
						.concatAll()
						.toArray()
						.map(() => {
							return this['index'].to_raw();
						})
						.concatAll()
						.map(data => {
							return this['index_store'].put(data, this['name']);
						})
						.concatAll()
						.subscribe(undefined, onError, () => {
							observer.onNext();
							observer.onCompleted();
						});
				}, onError);

		});
	}
}

function add_score(entry, score) {
	entry.score = () => {
		return score;
	};
}
