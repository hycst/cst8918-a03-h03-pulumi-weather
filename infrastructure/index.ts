import * as dockerBuild from "@pulumi/docker-build";

import * as pulumi from "@pulumi/pulumi";
import * as resources from "@pulumi/azure-native/resources";
import * as containerregistry from "@pulumi/azure-native/containerregistry";

//import * as containerinstance from "@pulumi/azure-native/containerinstance";
import * as containerinstance from "@pulumi/azure-native/containerinstance";


const config = new pulumi.Config();

const appPath = config.require("appPath");
const prefixName = config.require("prefixName");
const imageName = prefixName;
const imageTag = config.require("imageTag");

const containerPort = config.requireNumber("containerPort");
const publicPort = config.requireNumber("publicPort");
const cpu = config.requireNumber("cpu");
const memory = config.requireNumber("memory");

// Create a resource group.
const resourceGroup = new resources.ResourceGroup(`${prefixName}-rg`);

// Create the container registry.
// const registry = new containerregistry.Registry(`${prefixName}ACR`, {
const acrName = prefixName.replace(/-/g, "") + "acr";

const registry = new containerregistry.Registry(acrName, {  

  resourceGroupName: resourceGroup.name,
  adminUserEnabled: true,
  sku: {
    name: containerregistry.SkuName.Basic,
  },
});

// Get the authentication credentials for the container registry.
const registryCredentials = containerregistry
  .listRegistryCredentialsOutput({
    resourceGroupName: resourceGroup.name,
    registryName: registry.name,
  })
  .apply((creds) => {
    return {
      username: creds.username!,
      password: creds.passwords![0].value!,
    };
  });

// Temporary outputs for testing
// export const acrServer = registry.loginServer;
// export const acrUsername = registryCredentials.username;


const image = new dockerBuild.Image(`${prefixName}-image`, {
  tags: [
    pulumi.interpolate`${registry.loginServer}/${imageName}:${imageTag}`,
  ],
  context: { location: appPath },
  dockerfile: { location: `${appPath}/Dockerfile` },
 // target: "production",
 // platforms: ["linux/amd64", "linux/arm64"],
  platforms: ["linux/amd64"],
  push: true,
  registries: [
    {
      address: registry.loginServer,
      username: registryCredentials.username,
      password: registryCredentials.password,
    },
  ],
});



const containerGroup = new containerinstance.ContainerGroup(
  `${prefixName}-container-group`,
  {
    resourceGroupName: resourceGroup.name,
    osType: "Linux",
    restartPolicy: "Always",

    imageRegistryCredentials: [
      {
        server: registry.loginServer,
        username: registryCredentials.username,
        password: registryCredentials.password,
      },
    ],

    containers: [
      {
        name: imageName,
        image: image.ref,

        ports: [
          {
            port: containerPort,
            protocol: "TCP",
          },
        ],

        environmentVariables: [
          {
            name: "PORT",
            value: containerPort.toString(),
          },
          {
            name: "WEATHER_API_KEY",
//            value: "YOUR_OPENWEATHER_API_KEY",
            value: "23763f524c394237e934606a5a7e018f",

          },
        ],

        resources: {
          requests: {
            cpu: cpu,
            memoryInGB: memory,
          },
        },
      },
    ],

    ipAddress: {
      type: "Public",
      dnsNameLabel: imageName.replace(/[^a-z0-9]/gi, "").toLowerCase(),

      ports: [
        {
          port: publicPort,
          protocol: "TCP",
        },
      ],
    },
  }
);


export const hostname = containerGroup.ipAddress.apply(
  (addr) => addr!.fqdn!
);

export const ip = containerGroup.ipAddress.apply(
  (addr) => addr!.ip!
);

export const url = containerGroup.ipAddress.apply(
  (addr) => `http://${addr!.fqdn!}:${containerPort}`
);

