# shex-codegen

A library to generate typescript from Shape Expressions.

[Usage](#usage) | [Visitors](#visitors) | [Features](#features) | [Contributing](#contributing)

## Usage

Install the package via your preferred node package manager:
`npm i --save-dev shex-codegen` or `yarn add -D shex-codegen`

Add a config file to your project root directory called `shex-codegen.yml` with roughly the following structure:
```yaml
# path to the folder or file with shape expressions
schema: "src"
generates:
  # this will be the path of the generated file. It has to end with .ts
  node_modules/@generated/shex.ts:
    # the visitors to visit the schema with
    - typescript

```
Then you can use the package in one of your scripts e.g.:
```
{
  ...
  "develop": "... && yarn shex-codegen watch",
  ...
```
or 
```
{
  ...
  "build": "... && yarn shex-codegen generate",
  ...
```

## Visitors

### Typescript

An example Shape Expression like:
```
PREFIX srs: <https://shaperepo.com/schemas/solidProfile#>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX schem: <http://schema.org/>
PREFIX vcard: <http://www.w3.org/2006/vcard/ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

srs:SolidProfileShape EXTRA a {
  a [ schem:Person ]
    // rdfs:comment  "Declares the node to be a schema.org Person" ;
  a [ foaf:Person ]
    // rdfs:comment  "Declares the node to be a FOAF Person" ;
  vcard:hasPhoto IRI ?
    // rdfs:comment  "A link to the person's photo" ;
  foaf:name xsd:string ?
    // rdfs:comment  "An alternate way to define a person's name" ;
}
```

becomes
```typescript
// node_modules/@generated/shex.ts
import { NamedNode, Literal } from "rdflib";
import { Shape } from "shex-methods";

export type SolidProfileShape = {
  id: string; // the url of a node of this shape
  name?: string; // An alternate way to define a person's name
  hasPhoto?: string; // A link to the person's photo
} & {
  type: (
    | SolidProfileShapeType.SchemPerson
    | SolidProfileShapeType.FoafPerson
  )[]; // Defines the node as a Person
};

export type SolidProfileShapeCreateArgs = {
  id: string | NamedNode; // the url to match or create the node with e.g. 'https://example.com#this'
  name?: string | Literal; // An alternate way to define a person's name.
  hasPhoto?: URL | NamedNode; // A link to the person's photo
} & {
  type: (
    | SolidProfileShapeType.SchemPerson
    | SolidProfileShapeType.FoafPerson
  )[]; // Defines the node as a Person (from foaf)
};

export type SolidProfileShapeUpdateArgs = Partial<SolidProfileShapeCreateArgs>;

export enum SolidProfileShapeType {
  SchemPerson = "http://schema.org/Person",
  FoafPerson = "http://xmlns.com/foaf/0.1/Person",
}

export enum SolidProfileShapeContext {
  "type" = "rdf:type",
  "name" = "foaf:name",
  "hasPhoto" = "vcard:hasPhoto",
}
```

### Typescript methods
For this visitor you will need to additionaly install `shex-methods`

With a config like this:
```yaml
# path to the folder or file with shape expressions
schema: "src"
generates:
  # this will be the path of the generated file. It has to end with .ts
  node_modules/@generated/shex.ts:
    # the visitors to visit the schema with
    - typescript
    - typescript-methods
```

When using the above mentioned Shape Expression, this will be added to the generated code:
```typescript
export const solidProfile = new Shape<SolidProfileShape>({
  id: "https://shaperepo.com/schemas/solidProfile#SolidProfileShape",
  shape: solidProfileShex,
  context: SolidProfileShapeContext,
  type: SolidProfileShapeType,
});
```

You can then use the Shape object's methods to read, create, update or delete nodes of this shape. See [shex-methods](https://github.com/ludwigschubi/shex-methods) or [shex-codegen-demo](https://github.com/ludwigschubi/shex-codegen-demo)

## Features

Existing capabilities:
* Configure codegen with config file
* Generate Typescript types and enums from shex
* Typescript operations generator

Some planned features include:
* Typescript publisher/subscriber generator (in planning)
* Typescript react hooks (in planning)

## Contributing

Use `yarn develop` to start the build process in watch mode and run the tests on file changes.

If you have a use case in which the generated code is incorrect/corrupt please include an example in your pr/issue.
