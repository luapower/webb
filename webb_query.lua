--[==[

	webb | mysql query function
	Written by Cosmin Apreutesei. Public Domain.

PREPROCESSOR

	sqlval(s) -> s                                 quote string to SQL literal
	sqlname(s) -> s                                quote string to SQL identifier
	sqlparams(s, t) -> s                           quote query with :name placeholders.
	sqlquery(s, t) -> s                            quote query with any preprocessor directives.
	sqlrows(rows[, opt]) -> s                      quote rows to SQL insert values list
	sql_default                                    placeholder for default value
	qsubst(typedef)                                create a substitution definition
	qmacro.<name> = f(args...)                     create a macro definition

EXECUTION

	db(ns) -> db                                   get a connection's query API
	[db:]query([opt,]sql, ...) -> rows             query and return rows in a table
	[db:]first_row([opt,]sql, ...) -> t            query and return first row or value
	[db:]each_row([opt,]sql, ...) -> iter          query and iterate rows
	[db:]each_row_vals([opt,]sql, ...) -> iter     query and iterate rows unpacked
	[db:]each_group(col, [opt,]sql, ...) -> iter   query, group rows and and iterate groups
	[db:]atomic(func)                              execute func in transaction

DDL

	[db:]table_def(tbl) -> def                     table definition
	[db:]create_database(name)                     create database
	[db:]drop_table(name)                          drop table
	[db:]drop_tables('T1 T2 ...')                  drop multiple tables
	[db:]add_column(tbl, name, type, pos)          add column
	[db:]rename_column(tbl, old_name, new_name)    rename column
	[db:]drop_column(tbl, col)                     remove column
	[db:][re]add_fk(tbl, col, ...)                 (re)create foreign key
	[db:][re]add_uk(tbl, col)                      (re)create unique key
	[db:][re]add_ix(tbl, col)                      (re)create index
	[db:]drop_fk(tbl, col)                         drop foreign key
	[db:]drop_uk(tbl, col)                         drop unique key
	[db:]drop_ix(tbl, col)                         drop index
	[db:][re]add_trigger(name, tbl, on, code)      (re)create trigger
	[db:]drop_trigger(name, tbl, on)               drop trigger
	[db:][re]add_proc(name, args, code)            (re)create stored proc
	[db:]drop_proc(name)                           drop stored proc
	[db:][re]add_column_locks(tbl, cols)           trigger to make columns read-only

DEBUGGING

	pqr(rows, cols)                                pretty-print query result

]==]

require'webb'
sqlpp = require'sqlpp'.new()
require'sqlpp_mysql'
sqlpp.require'mysql'
sqlpp.require'mysql_domains'
local mysql_print = require'mysql_client_print'

sqlpp.keywords[null] = 'null'
sql_default = sqlpp.keyword.default
qsubst = sqlpp.subst
qmacro = sqlpp.macro

local function pconfig(ns, k, default)
	if ns then
		return config(ns..'_'..k, config(k, default))
	else
		return config(k, default)
	end
end

local free_cns = {} --{ns->{cn->true}}

function dbschema(ns)
	local default = assert(config('app_codename'))..(ns and '_'..ns or '')
	return pconfig(ns, 'db_schema', default)
end

function db(ns)
	ns = ns or false
	local cx = cx()
	local cn = attr(cx, 'cns')[ns]
	if not cn then
		local free_cns_ns = free_cns[ns]
		cn = free_cns_ns and next(free_cns_ns)
		if not cn then
			local t = {
				host      = pconfig(ns, 'db_host', '127.0.0.1'),
				port      = pconfig(ns, 'db_port', 3306),
				user      = pconfig(ns, 'db_user', 'root'),
				password  = pconfig(ns, 'db_pass'),
				schema    = dbschema(ns),
				charset   = 'utf8mb4',
			}
			log('CONNECT', '%s:%s user=%s db=%s', t.host, t.port, t.user, t.database)
			cn = sqlpp.connect(t)
			cx.cns[ns] = cn
		else
			free_cns_ns[cn] = nil
			cx.cns[ns] = cn
		end
		on_cleanup(function()
			cx.cns[ns] = nil
			attr(free_cns, ns)[cn] = true
		end)
	end
	return cn
end

function sqlpp.fk_message_remove()
	return S('fk_message_remove', 'Cannot remove {foreign_entity}: remove any associated {entity} first.')
end

function sqlpp.fk_message_set()
	return S('fk_message_set', 'Cannot set {entity}: {foreign_entity} not found in database.')
end

for method, name in pairs{
	--preprocessor
	sqlval=1, sqlrows=1, sqlname=1, sqlparams=1, sqlquery=1,
	--query execution
	use='use_schema', query=1, first_row=1, each_row=1, each_row_vals=1, each_group=1,
	atomic=1,
	--ddl
	table_def=1,
	create_database=1,
	drop_table=1, drop_tables=1,
	add_column=1, rename_column=1, drop_column=1,
	add_fk=1, readd_fk=1, drop_fk=1,
	add_uk=1, readd_uk=1, drop_uk=1,
	add_ix=1, readd_ix=1, drop_ix=1,
	add_trigger=1, readd_trigger=1, drop_trigger=1,
	add_proc=1, read_proc=1, drop_proc=1,
	add_column_locks=1, readd_column_locks=1,
	--mdl
	insert_row=1, insert_or_update_row=1, update_row=1, delete_row=1,
} do
	name = type(name) == 'string' and name or method
	_G[name] = function(...)
		local db = db()
		return db[method](db, ...)
	end
end

function pqr(rows, cols)
	return mysql_print.result(rows, cols)
end
