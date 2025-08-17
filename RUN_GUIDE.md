# How to Run This Project

Here is a complete guide to get the Run Tracker PWA running on your local machine.

## Prerequisites

You will need to have **Node.js** installed on your system. This project was developed with dependencies that require a modern version of Node. It is recommended to use **Node.js version 20.x or newer**.

You can check your Node.js version by running:
`node -v`

## Installation

Once you have Node.js installed, navigate to the project's root directory in your terminal and run the following command to install all the necessary dependencies:

```bash
npm install
```

This command will download all the packages listed in `package.json` into a `node_modules` folder.

## Running the Development Server

To run the application in development mode, use the following command:

```bash
npm run dev
```

This will start a local development server. You will see output in your terminal that looks something like this:

```
  VITE v5.0.0  ready in 380 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h to show help
```

You can then open your web browser and navigate to the local URL provided (usually `http://localhost:5173`) to see the application running. The development server supports Hot Module Replacement (HMR), so any changes you make to the source code will be reflected in the browser instantly.

## Building for Production

When you are ready to create a production-ready version of the app, run the following command:

```bash
npm run build
```

This command will bundle the application into static files and place them in the `dist` directory. These files are optimized for performance and can be deployed to any static web hosting service.
