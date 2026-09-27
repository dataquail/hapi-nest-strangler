import acl = require("./acl");

export const aclQueryPromise = (role: any, resource: any, action: string): Promise<boolean> =>
  new Promise((resolve, reject) => {
    acl.query(role, resource, action, (err, allowed) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(Boolean(allowed));
    });
  });
