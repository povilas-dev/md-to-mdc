#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

function isPathWithinBase(basePath: string, targetPath: string) {
  const relativePath = path.relative(basePath, targetPath);
  return !relativePath.startsWith('..');
}

export const transformMarkdownLinks = (
  content: string,
  currentFilePath: string,
  baseDir: string,
  baseOutputPath: string
) => {
  // Regular expression to match markdown links, including those with backticks
  const linkRegex = /\[((?:[^[\]]|\`[^\`]*\`)*)\]\((.*?)\)/g;
  const currentDir = path.dirname(currentFilePath);

  return content.replace(linkRegex, (match, text, url) => {
    // Skip external links (containing http:// or https://)
    if (url.match(/^https?:\/\//)) {
      return match;
    }

    // Check if it's a markdown file link
    if (url.includes('.md')) {
      // Extract the path without any hash
      let [filePath, _] = url.split('#');

      // Handle relative paths
      if (filePath.startsWith('./')) {
        filePath = filePath.replace(/^\.\//, '');
      }

      // Resolve the absolute path of the target file
      const absoluteTargetPath = path.resolve(currentDir, filePath);

      // Check if the target path is within the base directory
      if (!isPathWithinBase(baseDir, absoluteTargetPath)) {
        return match;
      }

      // Get the path relative to the base directory
      const relativeToBase = path.relative(baseDir, absoluteTargetPath);

      // Replace .md with .mdc and add suffix to the directory path
      const mdcFileName = relativeToBase.replace('.md', '.mdc');

      // Construct the new URL format
      return `[${filePath.replace(
        '.md',
        '.mdc'
      )}](mdc:${baseOutputPath}/${mdcFileName})`;
    }
    return match;
  });
};

function ensureDirectoryExists(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, {recursive: true});
  }
}

function createDescription(baseDir: string, inputPath: string) {
  const relativePath = path.relative(baseDir, inputPath);
  const capitalize = (str: string) =>
    str.charAt(0).toUpperCase() + str.slice(1);
  const rootDirName = path.basename(baseDir);
  const trueFileName = path.basename(inputPath);
  const formattedFileName = path
    .basename(inputPath, '.md')
    .split('-')
    .map(capitalize)
    .join(' ');
  const directories = relativePath
    .split(path.sep)
    .filter((el) => el !== '..' && el !== trueFileName);
  const formattedDirectories = directories
    .flatMap((el) => el.split('-').map(capitalize))
    .join(' ');
  // Always include rootDirName at the start
  return `${[capitalize(rootDirName), formattedDirectories]
    .filter(Boolean)
    .join(' ')}: ${formattedFileName}`;
}

function convertFile(
  inputPath: string,
  outputPath: string,
  baseDir: string,
  baseOutputPath: string
) {
  try {
    // Read the input file
    let content = fs.readFileSync(inputPath, 'utf8');

    // Remove existing frontmatter if present
    content = content.replace(/^---[\s\S]*?---\s*/, '');

    // Transform the content
    const transformedContent = transformMarkdownLinks(
      content,
      inputPath,
      baseDir,
      baseOutputPath
    );

    // Ensure the output directory exists
    ensureDirectoryExists(path.dirname(outputPath));

    // Generate the description using the new function
    const description = createDescription(baseDir, inputPath);

    // Prepare the YAML frontmatter
    const frontmatter = `---\ndescription: ${description}\nglobs:\nalwaysApply: false\n---\n\n`;

    // Write the frontmatter and transformed content to the new file
    fs.writeFileSync(outputPath, frontmatter + transformedContent);

    console.log(`Successfully converted ${inputPath} to ${outputPath}`);
  } catch (error) {
    console.error(`Error processing ${inputPath}:`, error);
  }
}

function processDirectory(inputDir: string, outputDir: string) {
  // Resolve the absolute path of the input directory
  const absoluteInputDir = path.resolve(inputDir);

  // Ensure output directory exists
  ensureDirectoryExists(outputDir);

  // Function to recursively process directories
  function processDir(
    currentPath: string,
    baseInputPath: string,
    baseOutputPath: string
  ) {
    const items = fs.readdirSync(currentPath);

    items.forEach((item) => {
      const fullPath = path.join(currentPath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // Recursively process subdirectories
        const relativeDir = path.relative(baseInputPath, fullPath);
        const outputSubDir = path.join(baseOutputPath, relativeDir);
        ensureDirectoryExists(outputSubDir);
        processDir(fullPath, baseInputPath, baseOutputPath);
      } else if (item.endsWith('.md')) {
        // Process markdown files
        const relativePath = path.relative(baseInputPath, fullPath);
        const outputPath = path.join(
          baseOutputPath,
          relativePath.replace('.md', '.mdc')
        );
        convertFile(fullPath, outputPath, absoluteInputDir, baseOutputPath);
      }
    });
  }

  // Start processing from the root directory
  processDir(inputDir, inputDir, path.normalize(outputDir));
  console.log(`Processed directory ${inputDir} to ${outputDir}`);
}

// Get command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('Usage: node md-to-mdc.js <inputDir> <outputDir>');
  process.exit(1);
}

const inputPath = args[0];
const outputPath = args[1];

const stat = fs.statSync(inputPath);

if (stat.isDirectory()) {
  processDirectory(inputPath, outputPath);
} else if (inputPath.endsWith('.md')) {
  // Output to specified output directory
  ensureDirectoryExists(outputPath);
  const baseName = path.basename(inputPath, '.md');
  const outFile = path.join(outputPath, `${baseName}.mdc`);
  // Use the input file's directory as baseDir for link transformation and description
  convertFile(
    inputPath,
    outFile,
    path.dirname(inputPath),
    path.basename(inputPath)
  );
} else {
  console.log(`Skipping ${inputPath} - not a markdown file or directory`);
}
