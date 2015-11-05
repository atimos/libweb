let Lunr = require('../lib/lunr.js/lunr.js'),
	Rx = require('../lib/rxjs/dist/rx.all.js');

export default function() {
	let index_map = new Map();

	return {
		index: function(name, cfg) {
			index_map.set(name, cfg);
			return this;
		},
		then: (resolve, reject) => {
			return new Promise(resolve => {
				for ( let [name, cfg] of index_map.entries() ) {
					index_map.set(name, new Index(cfg));
				}

				resolve(index_map);
			}).then(resolve, reject);
		}
	};
}

class Index {
	constructor(cfg) {
		this['index'] = null;
		this['cfg'] = cfg;
		this.clear();
	}

	put(item) {
		return update_index.call(this, 'update', [item]);
	}

	post(item) {
		return update_index.call(this, 'add', [item]);
	}

	post_transaction(item) {
		return update_index.call(this, 'add', [item], true);
	}

	put_list(items) {
		return update_index.call(this, 'update', items);
	}

	post_list(items) {
		return update_index.call(this, 'add', items);
	}

	post_list_transaction(item) {
		return update_index.call(this, 'add', item, true);
	}

	delete(keys = []) {
			let ref = this['cfg'].ref;
			return update_index.call(this, 'remove', (Array.isArray(keys) ? keys : [keys]).map(id => {
				return {[ref]: id};
			}));
	}

	search(query, limit = null) {
		let search_result = Rx.Observable.create(observer => {
			for ( [index, entry] of this['index'].search(query).entries() ) {
				if ( observer.isStopped || ( limit !== null && index >= limit ) ) {
					break;
				}

				observer.onNext(entry);
			}

			observer.onCompleted();
		});

		if ( limit !== null ) {
			return search_result.take(limit);
		}

		return search_result;
	}

	clear() {
		return new Promise(resolve => {
			let cfg = this['cfg'];

			this['index'] = Lunr(function() {
				this.ref(cfg.ref);

				cfg.fields
					.map(field => {
						this.field(field.name, {boost: field.boost||0});
					});
			});

			resolve();
		});
	}

	from_raw(data) {
		return new Promise(resolve => {
			this['index'] = Lunr.Index.load(data);
			resolve();
		});
	}

	to_raw_json() {
		return new Promise(resolve => {
			resolve(JSON.stringify(this['index']));
		});
	}

	to_raw() {
		return this.to_raw_json()
			.then(data => {
				return JSON.parse(data);
			});
	}
}

function update_index(action, data, transaction = false) {
	return Rx.Observable.create(observer => {
		let index = this['index'];

		for ( let [item_index, item] of data.entries() ) {
			try {
				if ( action === 'add' && index.documentStore.has(item[this['cfg'].ref]) ) {
					throw new Error('Id already exists');
				}

				index[action](item);
				observer.onNext(item);
			} catch (err) {
				if ( transaction === true ) {
					if ( action === 'add' ) {
						data.slice(0, item_index).forEach(index.remove.bind(index));
					}
				}

				err.data = item;
				return observer.onError(err);
			}
		}

		observer.onCompleted();
	});
}
