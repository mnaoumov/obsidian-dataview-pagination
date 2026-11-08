# Tables and lists

Every `TABLE` and `LIST` result longer than the smallest **Items per page** choice gets page controls. All the views below read the 120 numbers in [Numbers](<./Materials/01 Tables and lists/Numbers.md>).

The controls are **First**, **Previous**, the nearby page numbers, **Next** and **Last**, a page-size dropdown and a page box. Press `Enter` in the box to jump. The line below them shows the total.

## A DQL table

```dataview
TABLE WITHOUT ID item AS "Number"
WHERE file.name = "Numbers"
FLATTEN numbers AS item
```

## A DQL list

```dataview
LIST WITHOUT ID item
WHERE file.name = "Numbers"
FLATTEN numbers AS item
```

## `dv.table` and `dv.list`

Views drawn from `dataviewjs` are paged the same way.

```dataviewjs
const rows = Array.from({ length: 120 }, (_, index) => [index + 1, (index + 1) ** 2]);
dv.table(['Number', 'Square'], rows);
```

## What stays as it was

`TASK` and `CALENDAR` queries are not paged. A query with an error shows `Dataview`'s own message.
