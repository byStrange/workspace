#!/usr/bin/env node
import { Command } from "commander";
import inquirer from "inquirer";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { execa } from "execa";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();
const projectsFile = path.join(__dirname, "projects.json");

async function exec(command, args = []) {
  return await execa(command, args, { stdio: "inherit", shell: '/bin/zsh' });
}

async function runInNewTab(command, title = "Workspace - New Tab") {
  return await exec(`alacritty -T "${title}" -e sh -c "${command} && zsh"`);
}

if (!fs.existsSync(projectsFile)) {
  fs.writeJSONSync(projectsFile, []);
}

const loadProjects = () => {
  return fs.readJSONSync(projectsFile);
};

const saveProjects = (projects) => {
  fs.writeJSONSync(projectsFile, projects);
};

const addProject = async () => {
  const answers = await inquirer.prompt([
    {
      name: "rootPath",
      type: "input",
      message: "Enter the root folder path of the project:",
    },
    {
      name: "slug",
      type: "input",
      message: "Enter a unique slug for the project:",
      validate: (input) => {
        const projects = loadProjects();
        if (projects.find((p) => p.slug === input)) {
          return "Slug already exists. Please choose another.";
        }
        return true;
      },
    },
    {
      name: "runDocker",
      type: "confirm",
      message: "Should the project automatically run docker-compose up?",
    },
    {
      name: "runNvim",
      type: "confirm",
      message: "Should the project automatically run neovim?",
    },
    {
      name: "startupCommands",
      type: "input",
      message: "Enter startup commands",
      default: 'echo \'Project is getting started\'',
    },
  ]);

  const projects = loadProjects();
  projects.push(answers);
  saveProjects(projects);
  console.log(`Project ${answers.slug} added successfully!`);
};

const listProjects = () => {
  const projects = loadProjects();
  if (projects.length === 0) {
    console.log("No projects found.");
  } else {
    console.log("Projects:");
    projects.forEach((project) => {
      console.log(`- ${project.slug} (${project.rootPath})`);
    });
  }
};

const runProject = async (slug) => {
  const projects = loadProjects();
  const project = projects.find((p) => p.slug === slug);
  if (!project) {
    console.error(`Project with slug ${slug} not found.`);
    process.exit(1);
  }

  process.chdir(project.rootPath);

  console.log(project);
  if (project.startupCommands) {
    await runInNewTab(
      project.startupCommands,
      `Workspace - ${project.slug}: ${project.startupCommands}`
    );
  }

  if (project.runNvim) {
    await runInNewTab("nvim");
  }

  if (project.runDocker) {
    await runInNewTab("docker compose up");
  }
};

const runAllProjects = async () => {
  const projects = loadProjects();
  for (const project of projects) {
    await runProject(project.slug);
  }
};

const removeProject = (slug) => {
  const projects = loadProjects();
  const index = projects.findIndex((p) => p.slug === slug);
  if (index !== -1) {
    projects.splice(index, 1);
    saveProjects(projects);
    console.log(`Project ${slug} removed successfully!`);
  } else {
    console.error(`Project with slug ${slug} not found.`);
    process.exit(1);
  }
};

program
  .command("projects")
  .description("Manage projects")
  .option("-a, --add", "Add a new project")
  .option("-l, --list", "List all projects")
  .option("-r, --run <slug>", "Run a project")
  .option("-re, --remove <slug>", "Remove a project")
  .action(async (options) => {
    if (options.add) addProject();
    else if (options.list) listProjects();
    else if (options.run) runProject(options.run);
    else if (options.remove) removeProject(options.remove);
    else program.help();
  });

const projects = loadProjects();
projects.forEach((project) => {
  program
    .command(project.slug)
    .description(`Shortcut to start ${project.slug}`)
    .action(() => {
      runProject(project.slug);
    });
});

program
  .command("run")
  .description("Run a project")
  .argument("[string]", "Project slug to run")
  .option("-a, --all", "Run all projects")
  .action((slug, options) => {
    if (options.all) {
      runAllProjects();
    }
    if (slug) {
      runProject(slug);
    }
  });

program.parse(process.argv);
