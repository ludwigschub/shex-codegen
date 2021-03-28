# shex-codegen

A library to generate typescript objects from Shape Expressions.

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
```json
{
  ...
  "develop": "... && yarn shex-codegen watch",
  ...
```
or 
```json
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

srs:SolidProfileShape EXTRA a {
  a [ schem:Person ]
    // rdfs:comment  "Defines the node as a Person" ;
  a [ foaf:Person ]
    // rdfs:comment  "Defines the node as a Person" ;
  vcard:hasPhoto IRI ?
    // rdfs:comment  "A link to the person's photo" ;
  foaf:name xsd:string ?
    // rdfs:comment  "An alternate way to define a person's name" ;
}
```

becomes
```typescript
export type SolidProfileShape = {
  hasPhoto?: string; // A link to the person's photo
  name?: string; // An alternate way to define a person's name
  context: Record<string, string>; // An object that maps the property names to their corresponding iri's
} & {
  type?: (
    | SolidProfileShapeType.SchemPerson
    | SolidProfileShapeType.FoafPerson
  )[]; // Defines the node as a Person
};

export enum SolidProfileShapeType {
  SchemPerson = "http://schema.org/Person",
  FoafPerson = "http://xmlns.com/foaf/0.1/Person",
}
```

## Features

Existing capabilities:
* Configure codegen with config file
* Generate Typescript types and enums from shex

Some planned features include:
* Typescript operations generator (in planning)
* Typescript publisher/subscriber generator (in planning)
* Typescript react hooks (in planning)

## Contributing

Use `yarn develop` to start the build process in watch mode and run the tests on file changes.

If you have a use case in which the generated code is incorrect/corrupt please include an example in your pr/issue.
