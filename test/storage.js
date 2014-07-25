'use strict';
module storage from 'db/storage';

let QUnit = window.QUnit,
	config = {
		name: 'qunit',
		version: 1,
		stores: [
			{name: 'blogs', options: {keyPath: 'id', autoIncrement: true}, index: [
				{name: 'path', unique: true}
			]},
			{name: 'posts', options: {keyPath: 'id', autoIncrement: true}, index: [
				{name: 'blog', unique: false}
			]},
			{name: 'comments', options: {keyPath: 't'}, index: [
				{name: 'post', unique: false}
			]}
		]
	};

storage.reset('qunit').then();

QUnit.asyncTest('Reset database', assert => { 
	storage.reset('qunit').then(() => {
		assert.ok(true);
		QUnit.start();
	}).catch(err => {
		assert.ok(false, err.toString());
		QUnit.start();
	});
});

QUnit.asyncTest('Add new blog', assert => {
	let db = new storage.Storage(config),
		blog = {
			name: 'Add new blog',
			path: 'add-new-blog',
			created: Date.now(),
			author: 'Alex'
		};

	db.store('blogs').add(blog).then(saved_blog => {
		if ( saved_blog.id === undefined ) {
			assert.ok(false, 'Output does not contain an id');
		} else {
			blog.id = saved_blog.id;
			assert.propEqual(blog, saved_blog, 'Saved blog has right value');
		}
		QUnit.start();
	}).catch(err => {
		assert.ok(false, err.toString());
		QUnit.start();
	});
});

QUnit.asyncTest('Update blog', assert => {
	let blog_id, db = new storage.Storage(config),
		blog = {
			name: 'Update blog',
			path: 'update-blog',
			created: Date.now(),
			author: 'Alex'
		};

	db.store('blogs').add(blog).then(saved_blog => {
		blog_id = saved_blog.id;
		saved_blog.updated = Date.now();
		saved_blog.author = 'Alex2';
		return db.store('blogs').put(saved_blog);
	}).then(updated_blog => {
		assert.strictEqual(updated_blog.id, blog_id, 'Same id');
		assert.strictEqual(updated_blog.path, blog.path, 'Same path');
		assert.strictEqual(updated_blog.author, 'Alex2', 'Different author');
		QUnit.start();
	}).catch(err => {
		assert.ok(false, err.toString());
		QUnit.start();
	});
});

QUnit.asyncTest('Add same blog twice', assert => {
	let db = new storage.Storage(config),
		blog = {
			name: 'Add same blog twice',
			path: 'add-same-blog-twice',
			created: Date.now(),
			author: 'Alex'
		};

	db.store('blogs').add(blog).then(() => {
		return db.store('blogs').add(blog);
	}).then(() => {
		assert.ok(false, 'Added same blog twice');
		QUnit.start();
	}).catch(err => {
		assert.strictEqual(err.name, 'ConstraintError', 'Return ConstraintError when same same blog is added twice');
		QUnit.start();
	});
});

QUnit.asyncTest('Add two different blogs', assert => {
	let saved_blog1, db = new storage.Storage(config),
		blog1 = {
			name: 'Add two different blogs 1',
			path: 'add-two-different-blogs-1',
			created: Date.now(),
			author: 'Alex'
		},
		blog2 = {
			name: 'Add two different blogs 2',
			path: 'add-two-different-blogs-2',
			created: Date.now(),
			author: 'Alex'
		};

	db.store('blogs').add(blog1).then(saved_blog => {
		saved_blog1 = saved_blog;
		return db.store('blogs').add(blog2);
	}).then(saved_blog2 => {
		assert.notStrictEqual(saved_blog1.id, saved_blog2.id);
		QUnit.start();
	}).catch(err => {
		assert.ok(false, err.toString());
		QUnit.start();
	});
});

QUnit.asyncTest('Get blog', assert => {
	let db = new storage.Storage(config),
	blog = {
		name: 'Get blog',
		path: 'get-blog',
		created: Date.now(),
		author: 'Alex'
	};

	db.store('blogs').add(blog).then((saved_blog) => {
		blog.id = saved_blog.id;
		return db.store('blogs').get(saved_blog.id);
	}).then(retrieved_blog => {
		assert.propEqual(retrieved_blog, blog);
		QUnit.start();
	}).catch(err => {
		console.log(err);
		assert.ok(false, err.toString());
		QUnit.start();
	});
});

QUnit.asyncTest('Add multiple blogs and get list', assert => {
	let db = new storage.Storage(config),
	blog1 = {
		name: 'Get bloglist',
		path: 'get-bloglist1',
		created: Date.now(),
		author: 'Alex'
	},
	blog2 = {
		name: 'Get bloglist',
		path: 'get-bloglist2',
		created: Date.now(),
		author: 'Alex'
	};

	db.store('blogs').add([blog1, blog2]).then((saved_blogs) => {
		return db.store('blogs').get(saved_blogs.map(item => {
			return item.id;
		}));
	}).then(retrieved_bloglist => {
		assert.propEqual(retrieved_bloglist[0], blog1);
		assert.propEqual(retrieved_bloglist[1], blog2);
		QUnit.start();
	}).catch(err => {
		assert.ok(false, err.toString());
		QUnit.start();
	});
});
