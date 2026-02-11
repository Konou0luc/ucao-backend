/**
 * Définit req.tenant à partir du user connecté (req.user.institute).
 * À utiliser après authenticate. Si pas de user, req.tenant = null.
 */
export const setTenant = (req, res, next) => {
  req.tenant = req.user?.institute ?? null;
  next();
};
