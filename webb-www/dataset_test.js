
// helpers

function strrep(s, n) {
	return new Array(n+1).join(s)
}

function print_tree(d) {
	var s = ''
	for (var ri=0;ri<d.rowcount();ri++) {
		s += strrep('   ',d.row(ri).level)
		for (var fi=0;fi<d.fieldcount();fi++)
			s += d.val(ri, fi) + ' '
		s += '\n'
	}
	console.log('--------\n'+s+'----------')
}

// tree

var d = dataset({
	fields: [{name: 'id'},{name: 'name'},{name: 'parent_id'}],
	parent_id_field_name: 'parent_id',
	rows: [
		{values: [0,'a',null]},
		{values: [1,'b',null]},
		{values: [2,'c',0]},
		{values: [3,'d',0]},
		{values: [4,'e',2]},
		{values: [5,'f',2]},
		{values: [6,'g',5]},
	],
})

print_tree(d)
d.expand_all()
print_tree(d)

d.remove(0) // remove 0 and all its children
d.insert()  // insert at the end
d.setval(d.rowcount()-1, 1, 'z')
d.setval(0, 1, 'x')

print_tree(d)
console.log(d.json(d.changes()))

d.cancel_changes()
print_tree(d)
console.log(d.json(d.changes()))

// url

console.log(d.make_url('/path', ['a1', 'a2'], {b: 1, a: 2}))

