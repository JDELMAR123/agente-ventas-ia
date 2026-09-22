import type { FastifyRequest, FastifyReply } from "fastify";

/**
 * Protege /admin y /dashboard con usuario/contraseña (variables de entorno
 * ADMIN_USER / ADMIN_PASSWORD). Simple a propósito — es un panel interno,
 * no algo que use el cliente final.
 */
export function requireBasicAuth(req: FastifyRequest, reply: FastifyReply, done: (err?: Error) => void) {
  const user = process.env.ADMIN_USER;
  const password = process.env.ADMIN_PASSWORD;

  if (!user || !password) {
    reply.code(500).send("Falta configurar ADMIN_USER y ADMIN_PASSWORD en el servidor.");
    return;
  }

  const header = req.headers.authorization;
  if (header?.startsWith("Basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const [reqUser, reqPassword] = decoded.split(":");
    if (reqUser === user && reqPassword === password) {
      done();
      return;
    }
  }

  reply
    .code(401)
    .header("WWW-Authenticate", 'Basic realm="Panel de administración"')
    .send("Acceso restringido");
}
