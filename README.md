# md-to-mdc
Script for generating .mdc out of .md docs.

# Example usage:

1. Build the project.
2. Run the script inside your project:
```
yarn convert ../../<my-docs-location> .cursor/rules/<my-example-rules-location>
```

### NOTE!
Moving directories with rules in Cursor IDE DOES NOT update relative rule links!
If you move your rules between directories, "imports" are not "refactored" like moving code around in VSCode.
