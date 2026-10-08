import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <>
    <div className=" lg:h-[35rem] h-auto w-full flex gap-10  p-10 footer mb-[3rem]">
      <div className="ml-[4rem] flex flex-col ">
        <div className="flex items-center ml-[-10px]">
        <span className="bg"></span>
        <div className="gap-1">
          <span className="by  font-extrabold text-2xl lg:text-3xl ">by</span>
          <span className=" MUKESH font-extrabold text-2xl lg:text-3xl "> MUKESH</span>
        </div>
        </div>

        <div >
        <div>
            <pre className="lg:text-sm text-xs">Website Create & Handled by Mukesh B</pre>
        <ul className="flex gap-4 ">
            <li><a href="https://www.facebook.com/dreamlynetwok" className="hover:underline text-[13px] lg:text-[15px]" target=" "><pre>Powered by</pre></a></li>
            <li><a href="https://www.instagram.com/dreamlynetwork" className="hover:underline text-[13px] lg:text-[15px]" target=" "><pre>Dreamly Network</pre></a></li>

        </ul>
        </div></div>
      </div>

      <div className="lg:block hidden">
        <ul className="flex flex-col gap-[0.2rem] pb-5">
          <p className=" font-sans text-xs font-semibold pb-2">ARTISTS</p>
        <li><Link to={`/artists/456196`} >Vijay</Link> </li>
        <li><Link to={`/artists/456091`} >Yuvan Shankar Raja</Link> </li>
        <li><Link to={`/artists/485956`} >Honey Singh </Link> </li>
        <li><Link to={`/artists/672010`} >Jonita Gandhi </Link> </li>
        <li><Link to={`/artists/456876`} >Kalabhavan Mani </Link> </li>
        <li><Link to={`/artists/534301`} >Afsal </Link> </li></ul>
    </div>
    </div>

</>
  );
};

export default Footer;
