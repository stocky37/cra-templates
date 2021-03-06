const path = require('path');
const fs = require('fs-extra');
const ignore = require('ignore');
const dotProp = require('dot-prop');
const paths = require('../config/paths');
const renames = require('../config/renames');
const filters = require('../config/filters');

async function copyTemplateFiles(srcPath, destPath) {
	const ignorer = ignore().add(filters.ignored);
	const filter = ignorer.createFilter();
	const files = fs.readdirSync(srcPath);

	return Promise.all(
		files.filter(filter).map((src) => fs.copy(src, path.join(destPath, src), {dereference: true, filter}))
	);
}

async function applyRenames(srcPath) {
	const promises = [];
	Object.keys(renames).forEach((key) => {
		promises.push(fs.move(path.join(srcPath, key), path.join(srcPath, renames[key]), {overwrite: true}));
	});
	return Promise.all(promises);
}

function buildTemplateJson(packageJson) {
	const filtered = {...packageJson};
	filters.templateJsonKeys.forEach((key) => dotProp.delete(filtered, key));
	return {
		package: {
			...filtered,
			dependencies: {
				...filtered.dependencies,
				...filtered.devDependencies,
			},
		},
	};
}

function buildTemplatePackageJson(packageJson) {
	const filtered = {...packageJson};
	filters.packageJsonKeys.forEach((key) => dotProp.delete(filtered, key));
	return {
		...filtered,
		name: `cra-${filtered.name}`,
		files: ['template', 'template.json'],
		main: 'template.json',
	};
}

async function sourceFromPackageJson(packageJsonPath, destPath, mapFunc = (pkg) => pkg) {
	return fs.readJson(packageJsonPath).then((pkg) => fs.writeJson(destPath, mapFunc(pkg), {spaces: 2}));
}

Promise.all([
	copyTemplateFiles(paths.appPath, paths.templateBuild).then(async () => applyRenames(paths.templateBuild)),
	sourceFromPackageJson(paths.appPackageJson, paths.templateJson, buildTemplateJson),
	sourceFromPackageJson(paths.appPackageJson, paths.templatePackageJson, buildTemplatePackageJson),
]).then();
