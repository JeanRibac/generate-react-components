const chalk = require('chalk');
const path = require('path');
const replace = require('replace');
const { existsSync, outputFileSync, readFileSync } = require('fs-extra');

const componentJsTemplate = require('../templates/component/componentJsTemplate');
const componentTsTemplate = require('../templates/component/componentTsTemplate');
const componentCssTemplate = require('../templates/component/componentCssTemplate');

// private

function loadCustomTemplate(templatePath) {
  // --- Try loading custom template

  try {
    const template = readFileSync(templatePath, 'utf8');
    const templateFileExtension = path.extname(templatePath).split('.')[1];

    return { template, templateFileExtension };
  } catch (e) {
    console.error(
      chalk.red(
        `
ERROR: The custom template path of "${templatePath}" does not exist. 
Please make sure you're pointing to the right custom template path in your generate-react-cli.json config file.
        `
      )
    );

    return process.exit(1);
  }
}

function getComponentScriptTemplate({ cmd, cliConfigFile, componentName, componentPathDir }) {
  const { cssPreprocessor, testLibrary, usesCssModule, usesTypeScript } = cliConfigFile;
  const { customTemplates } = cliConfigFile.component[cmd.type];
  let fileExtension = usesTypeScript ? 'tsx' : 'js';
  let template = null;

  // Check for a custom component template.

  if (customTemplates && customTemplates.component) {
    // --- Load and use the custom component template

    const { template: loadedTemplate, templateFileExtension } = loadCustomTemplate(customTemplates.component);

    template = loadedTemplate;
    fileExtension = templateFileExtension;
  } else {
    // --- Else use GRC built-in component template

    template = usesTypeScript ? componentTsTemplate : componentJsTemplate;

    // --- If it has a corresponding stylesheet

    if (cmd.withStyle) {
      const module = usesCssModule ? '' : '';
      const cssPath = `${componentName}${module}.${cssPreprocessor}`;

      // --- If the css module is true make sure to update the template accordingly

      if (module.length) {
        template = template.replace(`'./TemplateName.css'`, `'./${cssPath}'`);
      } else {
        template = template.replace(`{styles.TemplateName}`, `"${componentName}"`);
        template = template.replace(`styles from './TemplateName.css'`, `'./${cssPath}'`);
      }
    } else {
      // --- If no stylesheet, remove className attribute and style import from jsTemplate

      template = template.replace(` className={styles.TemplateName}`, '');
      template = template.replace(`import styles from './TemplateName.css';`, '');
    }
  }

  return {
    template,
    templateType: `Component "${componentName}.${fileExtension}"`,
    componentPath: `${componentPathDir}/${componentName}.${fileExtension}`,
    componentName,
  };
}

function getComponentStyleTemplate({ cliConfigFile, cmd, componentName, componentPathDir }) {
  const { customTemplates } = cliConfigFile.component[cmd.type];
  const { cssPreprocessor, usesCssModule } = cliConfigFile;
  const module = usesCssModule ? '' : '';
  const cssPath = `${componentName}${module}.${cssPreprocessor}`;
  let template = null;

  // Check for a custom style template.

  if (customTemplates && customTemplates.style) {
    // --- Load and use the custom style template

    const { template: loadedTemplate } = loadCustomTemplate(customTemplates.style);

    template = loadedTemplate;
  } else {
    // --- Else use GRC built-in style template

    template = componentCssTemplate;
  }

  return {
    template,
    templateType: `Stylesheet "${cssPath}"`,
    componentPath: `${componentPathDir}/${cssPath}`,
    componentName,
  };
}

// public

// --- Template Types

const componentTemplateTypes = {
  STYLE: 'withStyle',
  COMPONENT: 'component',
};

// --- Template Map

const templateMap = {
  [componentTemplateTypes.STYLE]: getComponentStyleTemplate,
  [componentTemplateTypes.COMPONENT]: getComponentScriptTemplate,
};

function generateComponentTemplates(componentTemplates) {
  for (let i = 0; i < componentTemplates.length; i += 1) {
    const { template, templateType, componentPath, componentName } = componentTemplates[i];

    // --- Make sure the component templateType does not already exist in the path directory.

    if (existsSync(componentPath)) {
      console.error(chalk.red(`${templateType} already exists in this path "${componentPath}".`));
    } else {
      try {
        outputFileSync(componentPath, template);

        const replaceDefaultOptions = {
          regex: 'TemplateName',
          replacement: componentName,
          paths: [componentPath],
          recursive: false,
          silent: true,
        };

        replace(replaceDefaultOptions);

        console.log(chalk.green(`${templateType} was created successfully at ${componentPath}`));
      } catch (error) {
        console.error(chalk.red(`${templateType} failed and was not created.`));
        console.error(error);
      }
    }
  }
}

function getComponentTemplate(cmd, cliConfigFile, componentName, templateType) {
  const componentPathDir = `${cmd.path}/${componentName}`;

  if (templateMap[templateType]) {
    return templateMap[templateType]({ cmd, cliConfigFile, componentName, componentPathDir });
  }

  return null;
}

module.exports = {
  componentTemplateTypes,
  generateComponentTemplates,
  getComponentTemplate,
};
