import AvailabilityEditor from "../components/AvailabilityEditor";

export default function AvailabilityPage() {
  return (
    <>
      <div className="page-head">
        <h1>Your availability</h1>
        <p className="page-sub">
          Open the times you are free. Students booking any of your listings
          pick from these, and a time closes across all of them once it is
          taken, since you can only be in one place at once.
        </p>
      </div>

      <AvailabilityEditor />
    </>
  );
}
