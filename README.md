# Obsidian TaskWarrior plugin

Small and simple markdown syntax for querying taskwarrior reports

Inspired by [taskwiki](https://github.com/tools-life/taskwiki) and [tq-obsidian](https://github.com/tgrosinger/tq-obsidian)

## Usage

Use the `tw` language

```tw
report
filters
template
```

`template` and `filters` parameters are optional

The `template` parameter gives new tasks created with this report specified default values

Hold `Alt` to delete tasks

Click on a task row to modify it

### Example

```tw
list
project:taskwarrior +work scheduled.after:socw-1hour
```
equivalent to `task list project:taskwarrior +work scheduled.after:socw-1hour`