--[==[

	webb | mysql query function
	Written by Cosmin Apreutesei. Public Domain.

PREPROCESSOR

	sqlval(s) -> s                            quote string to SQL literal
	sqlname(s) -> s                           quote string to SQL identifier
	sqlparams(s, t) -> s                      quote query with ? and :name placeholders.
	sqlrows(rows[, opt]) -> s                 quote rows to SQL insert values list
	sql_default                               placeholder for default value
	sqlunquoted(s) -> f() -> s                generate an unquoted value to use in sqlrows()
	qsubst(typedef)                           create a substitution definition
	qmacro.<name> = f(args...)                create a macro definition

EXECUTION

	[p]query[_on]([ns,][opt,]sql, args...) -> res     query and return result table (compact)
	[p]kv_query[_on]([ns,][opt,]sql, args...) -> res  query and return result table (key-val)
	[p]query1[_on]([ns,][opt,]sql, args...) -> t      query and return first row
	[p]iquery[_on]([ns,][opt,]sql, args...) -> id     query and return insert id
	atomic(func)                                      execute func in transaction

RESULT PROCESSING

	changed(res) -> t|f                       check if any rows were updated
	groupby(col, res) -> t                    group rows by a column

DDL

	allow_drop([t|f]) -> t|f                  control dropping of tables and fks
	create_database(name)                     create a database
	drop_table(name)                          drop table
	drop_tables('T1 T2 ...')                  drop multiple tables
	[re]add_fk(tbl, col, ...)                 (re)create a foreign key
	[re]add_uk(tbl, col)                      (re)create a unique key
	[re]add_ix(tbl, col)                      (re)create an index
	[re]add_trigger(name, tbl, on, code)      (re)create a trigger
	[re]add_column_locks(tbl, cols)           trigger to make columns read-only
	drop_fk(tbl, col)                         drop foreign key
	drop_uk(tbl, col)                         drop unique key
	drop_ix(tbl, col)                         drop index
	drop_trigger(name, tbl, on)               drop trigger
	add_column(tbl, name, type, pos)          add column
	rename_column(tbl, old_name, new_name)    rename column
	drop_column(tbl, col)                     remove column

DEBUGGING

	prq(rows, cols)                           pretty-print query result

]==]

require'webb'
local mysql = require'mysql_client'
local errors = require'errors'
local raise = errors.raise
local mysql_print = require'mysql_client_print'
local spp = require'sqlpp'.new()

spp.require'mysql'
spp.keywords[null] = 'null'
sql_default = spp.keyword.default
sqlval = spp.value
sqlrows = spp.rows
sqlname = spp.name
sqlparams = spp.params
qsubst = spp.subst
qmacro = spp.macro

function sqlunquoted(s)
	return function() return s end
end

--db connection --------------------------------------------------------------

local function assert_db(ret, ...)
	if ret ~= nil then
		return ret, ...
	end
	local err, errno, sqlstate = ...
	err = err:gsub('You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near ', 'Syntax error: ')
	raise('db', {err = err, errno = errno, sqlstate = sqlstate, addtraceback = true},
		'%s%s%s', err,
			errno and ' ['..errno..']' or '',
			sqlstate and ' '..sqlstate or '')
end

local function pconfig(ns, k, default)
	if ns then
		return config(ns..'_'..k, config(k, default))
	else
		return config(k, default)
	end
end

local free_dbs = {} --{db->true}

local function connect(ns)
	ns = ns or false
	local cx = cx()
	local db = cx.db
	if not db then
		local dbs = free_dbs[ns]
		db = dbs and next(dbs)
		if not db then
			db = assert(mysql:new())
			cx.db = db
			local t = {
				host     = pconfig(ns, 'db_host', '127.0.0.1'),
				port     = pconfig(ns, 'db_port', 3306),
				database = pconfig(ns, 'db_name'),
				user     = pconfig(ns, 'db_user', 'root'),
				password = pconfig(ns, 'db_pass'),
			}
			log('CONNECT', '%s:%s user=%s db=%s', t.host, t.port, t.user, t.database)
			assert_db(db:connect(t))
		else
			cx.db = db
			dbs[db] = nil
		end
		on_cleanup(function()
			cx.db = nil
			attr(free_dbs, ns)[db] = true
		end)
	end
	return db
end

--query execution ------------------------------------------------------------

local function process_result(t, cols, compact)
	if cols and #cols == 1 then --single column result: return it as array
		local t0 = t
		t = {}
		if compact then
			for i,row in ipairs(t0) do
				t[i] = row[1]
			end
		else
			for i,row in ipairs(t0) do
				local k,v = next(row)
				t[i] = v
			end
		end
	end
	return t
end

local function run_query(compact, traceq, ns, opt, sql, ...)
	local t = ...
	if type(opt) == 'string' then --sql, ...
		sql, t = opt, sql
		opt = nil
		if type(t) ~= 'table' then
			t = {t, ...}
		end
	else --opt, sql, ...
		if type(t) ~= 'table' then
			t = {...}
		end
	end
	local db = connect(ns)
	local sqls, params = spp.queries(sql, t)
	local t, cols, params, ts
	for sql_i, sql in ipairs(sqls) do
		ts = ts or (sql_i > 1 and {{t, cols, params}})
		local qtrace = traceq and trace('QUERY', '\n%s', glue.outdent(sql))
		assert_db(db:send_query(sql))
		t, err, cols = assert_db(db:read_result(nil, compact and 'compact'))
		t = process_result(t, cols, compact)
		if err == 'again' then --multi-result/multi-statement query
			t = {t}
			repeat
				local t1, err = assert_db(db:read_result())
				t1 = process_result(t1, cols, compact)
				t[#t+1] = t1
			until not err
		end
		if qtrace then
			qtrace('QUERY', '%s', #t > 0 and 'rows: '..#t or pp.format(t))
		end
		if ts then add(ts, {t, cols, params}) end
	end
	if ts then
		return ts
	else
		return t, cols, params
	end
end

local function run_query1(...) --query first row (or first row/column) and close
	local rows, cols, params = run_query(...)
	local row = rows[1]
	if not row then return end
	if #cols == 1 then
		return row, params --row is actually the value
	end --first row/col
	return row, params --first row
end

local function run_iquery(...) --insert query: return the value of the auto_increment field.
	local t, cols, params = run_query(...)
	local id = t.insert_id
	return id ~= 0 and id or nil, params
end

function query_on     (...) return run_query  (true , false, ...) end
function pquery_on    (...) return run_query  (true , true , ...) end
function kv_query_on  (...) return run_query  (false, false, ...) end
function pkv_query_on (...) return run_query  (false, true , ...) end
function query1_on    (...) return run_query1 (false, false, ...) end
function pquery1_on   (...) return run_query1 (false, true , ...) end
function iquery_on    (...) return run_iquery (true , false, ...) end
function piquery_on   (...) return run_iquery (true , true , ...) end
function query        (...) return run_query  (true , false, nil, ...) end
function pquery       (...) return run_query  (true , true , nil, ...) end
function kv_query     (...) return run_query  (false, false, nil, ...) end
function pkv_query    (...) return run_query  (false, true , nil, ...) end
function query1       (...) return run_query1 (false, false, nil, ...) end
function pquery1      (...) return run_query1 (false, true , nil, ...) end
function iquery       (...) return run_iquery (true , false, nil, ...) end
function piquery      (...) return run_iquery (true , true , nil, ...) end

function atomic(func)
	query'start transaction'
	local ok, err = glue.pcall(func)
	query(ok and 'commit' or 'rollback')
	assert(ok, err)
end

--result processing ----------------------------------------------------------

function changed(res)
	return tonumber(res.message:match'Changed: (%d+)') > 0
end

function groupby(col, items)
	local t = {}
	if not col or not items then return t end
	local v
	local st
	local group_func = col
	if type(col) == 'string' or type(col) == 'number' then
		group_func = function(e) return e[col] end
	end
	for i,e in ipairs(items) do
		local v1 = group_func(e)
		if not st or v ~= v1 then
			st = {}
			t[#t+1] = st
		end
		st[#st+1] = e
		v = v1
	end
	return t
end

--ddl ------------------------------------------------------------------------

function allow_drop(on)
	if on ~= nil then
		spp.allow_drop = on
	else
		return spp.allow_drop
	end
end

update(_G, spp.command_api(pquery))

--debugging ------------------------------------------------------------------

function prq(rows, cols)
	return mysql_print.result(rows, cols)
end
