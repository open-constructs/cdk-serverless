import { AdminAddUserToGroupCommand, AdminCreateUserCommand, AdminDeleteUserCommand, AdminSetUserPasswordCommand, CognitoIdentityProviderClient, MessageActionType } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient, NativeAttributeValue } from '@aws-sdk/lib-dynamodb';
import { Axios, AxiosRequestConfig, HttpStatusCode } from 'axios';
import { CFN_OUTPUT_SUFFIX_AUTH_IDENTITYPOOL_ID, CFN_OUTPUT_SUFFIX_AUTH_USERPOOLID, CFN_OUTPUT_SUFFIX_AUTH_USERPOOL_CLIENTID, CFN_OUTPUT_SUFFIX_DATASTORE_TABLENAME, CFN_OUTPUT_SUFFIX_RESTAPI_URL } from '../shared/outputs';

export interface IntegTestUtilOptions {

  readonly region: string;

  readonly apiOptions?: {
    readonly baseURL?: string;
  };

  readonly authOptions?: {
    readonly userPoolId?: string;

    readonly userPoolClientId?: string;
    readonly userPoolClientSecret?: string;

    readonly identityPoolId?: string;
  };

  readonly datastoreOptions?: {
    readonly tableName?: string;
  };

}

export interface CfnOutputConfig {
  readonly region: string;
  readonly apiName: string;
  readonly datastoreName: string;
}

export function parseCfnOutputs(output: any, stackName: string, config: CfnOutputConfig): IntegTestUtilOptions {
  const outputs = output[stackName];
  return {
    region: config.region,
    apiOptions: {
      baseURL: outputs[`${config.apiName}${CFN_OUTPUT_SUFFIX_RESTAPI_URL}`],
    },
    authOptions: {
      userPoolId: outputs[CFN_OUTPUT_SUFFIX_AUTH_USERPOOLID],
      userPoolClientId: outputs[CFN_OUTPUT_SUFFIX_AUTH_USERPOOL_CLIENTID],
      identityPoolId: outputs[CFN_OUTPUT_SUFFIX_AUTH_IDENTITYPOOL_ID],
    },
    datastoreOptions: {
      tableName: `${config.datastoreName}${outputs[CFN_OUTPUT_SUFFIX_DATASTORE_TABLENAME]}`,
    },
  };
}

export class IntegTestUtil {

  public readonly tableName?: string;

  private apiTokens: { [email: string]: string } = {};
  private itemsToDelete: Record<string, NativeAttributeValue>[] = [];

  constructor(protected options: IntegTestUtilOptions) {
    process.env.AWS_REGION = options.region;
    process.env.AWS_DEFAULT_REGION = options.region;
    if (options.datastoreOptions?.tableName) {
      process.env.TABLE = options.datastoreOptions.tableName;
      this.tableName = options.datastoreOptions.tableName;
    }
  }

  // AUTH

  public getClient(config?: AxiosRequestConfig) {
    return new Axios({
      baseURL: this.options.apiOptions?.baseURL,
      transformResponse: (data) => {
        try {
          return JSON.parse(data);
        } catch (error) {
          return data;
        }
      },
      transformRequest: (data) => {
        try {
          return JSON.stringify(data);
        } catch (error) {
          return data;
        }
      },
      ...config,
    });
  }

  public async getAuthenticatedClient(email: string, password?: string, config?: AxiosRequestConfig) {
    if (!this.apiTokens[email]) {
      if (!password) {
        throw new Error('No password provided; You can only leave password blank for users created by this utility');
      }
      await this.loginUser(email, password);
    }
    return this.getClient({
      headers: {
        Authorization: `Bearer ${this.apiTokens[email]}`,
        ...(config?.headers ?? {}),
      },
      ...config,
    });
  }

  // DATASTORE

  public initializeItemsToCleanup() {
    this.itemsToDelete = [];
  }

  public addItemToDeleteAfterTest(key: Record<string, NativeAttributeValue>) {
    this.itemsToDelete.push(key);
  }

  public async cleanupItems() {
    const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: this.options.region }));
    for (const item of this.itemsToDelete) {
      try {
        await ddb.send(new DeleteCommand({ TableName: this.tableName, Key: item }));
      } catch (error) {
        console.log(error);
      }
    }
  }

  // AUTH

  public async createUser(email: string, attributes: { [key: string]: string }, groups: string[]) {
    if (!this.options.authOptions?.userPoolId) {
      throw new Error('No userPoolId configured');
    }

    const randomPassword: string = Math.random().toString(36).slice(-16);

    const cognitoClient: CognitoIdentityProviderClient = new CognitoIdentityProviderClient({ region: this.options.region });
    // Create a new user in Cognito
    await cognitoClient.send(new AdminCreateUserCommand({
      UserPoolId: this.options.authOptions?.userPoolId,
      Username: email,
      MessageAction: MessageActionType.SUPPRESS,
      TemporaryPassword: randomPassword,
      UserAttributes: [{
        Name: 'email',
        Value: email,
      }, {
        Name: 'email_verified',
        Value: 'true',
      },
      ...Object.entries(attributes).map((attr) => ({
        Name: attr[0],
        Value: attr[1],
      }))],
    }));
    // Make password permanent to get user out of FORCE_CHANGE_PASSWORD
    await cognitoClient.send(new AdminSetUserPasswordCommand({
      UserPoolId: this.options.authOptions?.userPoolId,
      Username: email,
      Password: randomPassword,
      Permanent: true,
    }));
    // Add user to groups
    for (const group of groups) {
      await cognitoClient.send(new AdminAddUserToGroupCommand({
        UserPoolId: this.options.authOptions?.userPoolId,
        Username: email,
        GroupName: group,
      }));
    }

    await this.loginUser(email, randomPassword);
  }

  public async removeUser(email: string) {
    if (!this.options.authOptions?.userPoolId) {
      throw new Error('No userPoolId configured');
    }
    const cognitoClient: CognitoIdentityProviderClient = new CognitoIdentityProviderClient({ region: this.options.region });
    await cognitoClient.send(new AdminDeleteUserCommand({
      UserPoolId: this.options.authOptions?.userPoolId,
      Username: email,
    }));
    delete this.apiTokens[email];
  }


  protected async loginUser(email: string, password: string) {
    if (!this.options.authOptions?.userPoolClientId) {
      throw new Error('No userPoolClientId configured');
    }
    const cognitoClient = new Axios({
      baseURL: `https://cognito-idp.${this.options.region}.amazonaws.com/`,
    });
    const auth = await cognitoClient.post('/', JSON.stringify({
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: this.options.authOptions.userPoolClientId,
    }), {
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
      },
    });
    if (auth.status !== HttpStatusCode.Ok) {
      throw new Error(`Failed to authenticate user ${email}`);
    }
    this.apiTokens[email] = JSON.parse(auth.data).AuthenticationResult.IdToken;
  }
}